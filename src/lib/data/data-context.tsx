"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../auth-context";
import { applyClassification, DEFAULT_KEYWORDS } from "../classify";
import type { ImportPlan } from "../csv/import-plan";
import { extractFirstName } from "../names";
import { contactAfterMessage, hasBeenContacted, markMessageSent, recordReply, reopenMessage, skipMessage } from "../status";
import { DEFAULT_TEMPLATE_BODY, DEFAULT_TEMPLATE_NAME, renderTemplate } from "../templates";
import type {
  ActivityLog, ClassificationStatus, Contact, CvDocument, MessageTemplate, OutreachCampaign, OutreachMessage, SendingMethod, UserSettings,
} from "../types";
import { newId, nowIso, stableHash } from "../utils";
import { buildDemoContacts } from "./demo-data";
import { getStore } from "./get-store";
import { deleteCv, uploadCvFile } from "../cv-client";

interface DataState {
  loading: boolean;
  error: string | null;
  contacts: Contact[];
  templates: MessageTemplate[];
  messages: OutreachMessage[];
  campaigns: OutreachCampaign[];
  cvs: CvDocument[];
  logs: ActivityLog[];
  settings: UserSettings | null;
  selectedCv: CvDocument | null;
  reload(): Promise<void>;
  saveContact(c: Contact, log?: string): Promise<void>;
  setClassification(ids: string[], status: ClassificationStatus): Promise<void>;
  applyImport(plan: ImportPlan, fileName: string): Promise<void>;
  reclassify(): Promise<number>;
  loadDemo(): Promise<void>;
  removeDemo(): Promise<void>;
  prepareMessages(contactIds: string[], templateId: string, method: SendingMethod): Promise<{ created: number; reused: number; skippedContacted: number }>;
  saveMessage(m: OutreachMessage): Promise<void>;
  rerender(messageId: string): Promise<void>;
  markSent(messageId: string, confirmed: boolean, finalText?: string): Promise<void>;
  skip(messageId: string): Promise<void>;
  reopen(messageId: string): Promise<void>;
  reply(messageId: string): Promise<void>;
  saveTemplate(t: MessageTemplate): Promise<void>;
  deleteTemplate(id: string): Promise<void>;
  setDefaultTemplate(id: string): Promise<void>;
  saveSettings(patch: Partial<UserSettings>, log?: string): Promise<void>;
  uploadCv(file: File): Promise<void>;
  removeCv(cv: CvDocument): Promise<void>;
}

const Ctx = createContext<DataState | null>(null);

function defaultSettings(ownerId: string, now: string, displayName: string): UserSettings {
  return {
    id: ownerId,
    ownerId,
    keywords: DEFAULT_KEYWORDS.map((term) => ({ id: `kw_${stableHash(term)}`, term, enabled: true })),
    selectedCvId: null,
    defaultTemplateId: null,
    senderName: displayName,
    linkedInProfileUrl: "",
    portfolioUrl: "",
    locale: "en",
    theme: "system",
    createdAt: now,
    updatedAt: now,
  };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, demo } = useAuth();
  const uid = user?.uid ?? null;
  const displayName = user?.displayName ?? "";
  const [state, setState] = useState({
    loading: true, error: null as string | null, contacts: [] as Contact[], templates: [] as MessageTemplate[], messages: [] as OutreachMessage[],
    campaigns: [] as OutreachCampaign[], cvs: [] as CvDocument[], logs: [] as ActivityLog[], settings: null as UserSettings | null,
  });

  const reload = useCallback(async () => {
    if (!uid) return;
    try {
      const s = getStore();
      const now = nowIso();
      const [settingsList, loadedTemplates] = await Promise.all([s.list<UserSettings>("userSettings", uid), s.list<MessageTemplate>("messageTemplates", uid)]);
      let templates = loadedTemplates;
      const first = settingsList[0];
      let settings: UserSettings | null = first ? { ...first, linkedInProfileUrl: first.linkedInProfileUrl ?? "", portfolioUrl: first.portfolioUrl ?? "" } : null;
      if (!settings) {
        settings = defaultSettings(uid, now, displayName);
        await s.put("userSettings", settings);
      }
      if (!templates.length) {
        const t: MessageTemplate = { id: newId("tpl"), ownerId: uid, name: DEFAULT_TEMPLATE_NAME, body: DEFAULT_TEMPLATE_BODY, isDefault: true, createdAt: now, updatedAt: now };
        await s.put("messageTemplates", t);
        templates = [t];
        settings = { ...settings, defaultTemplateId: t.id };
        await s.put("userSettings", settings);
      }
      const [contacts, messages, campaigns, cvs, logs] = await Promise.all([
        s.list<Contact>("contacts", uid), s.list<OutreachMessage>("outreachMessages", uid), s.list<OutreachCampaign>("outreachCampaigns", uid),
        s.list<CvDocument>("cvDocuments", uid), s.list<ActivityLog>("activityLogs", uid, { limit: 200, newestFirstBy: "createdAt" }),
      ]);
      setState({ loading: false, error: null, contacts, templates, messages, campaigns, cvs, logs, settings });
    } catch (e) {
      setState((p) => ({ ...p, loading: false, error: e instanceof Error ? e.message : "load_failed" }));
    }
  }, [uid, displayName]);

  useEffect(() => {
    if (!uid) {
      setState((p) => ({ ...p, loading: false }));
      return;
    }
    setState((p) => ({ ...p, loading: true }));
    void reload();
  }, [uid, reload]);

  const log = useCallback(async (action: string, entityType: string, entityId: string, details = "") => {
    if (!uid) return;
    const entry: ActivityLog = { id: newId("log"), ownerId: uid, action, entityType, entityId, details: details.slice(0, 500), createdAt: nowIso() };
    await getStore().put("activityLogs", entry);
    setState((p) => ({ ...p, logs: [entry, ...p.logs].slice(0, 200) }));
  }, [uid]);

  const upsertLocal = <T extends { id: string }>(list: T[], item: T): T[] => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);

  const api = useMemo<DataState | null>(() => {
    if (!uid) return null;
    const store = getStore();
    const keywords = () => state.settings?.keywords ?? [];
    const sender = () => ({ senderName: state.settings?.senderName, senderLinkedIn: state.settings?.linkedInProfileUrl, portfolio: state.settings?.portfolioUrl });

    const saveContact: DataState["saveContact"] = async (c, logText) => {
      const next = { ...c, updatedAt: nowIso() };
      await store.put("contacts", next);
      setState((p) => ({ ...p, contacts: upsertLocal(p.contacts, next) }));
      if (logText) await log(logText, "contact", c.id, c.fullName);
    };

    const saveMessage: DataState["saveMessage"] = async (m) => {
      const next = { ...m, updatedAt: nowIso() };
      await store.put("outreachMessages", next);
      setState((p) => ({ ...p, messages: upsertLocal(p.messages, next) }));
    };

    const contactOf = (id: string) => state.contacts.find((c) => c.id === id);
    const messageOf = (id: string) => state.messages.find((m) => m.id === id);

    /** Persist a message transition together with the derived contact state. */
    const commit = async (m: OutreachMessage, action: string) => {
      const now = nowIso();
      await store.put("outreachMessages", m);
      const c = contactOf(m.contactId);
      let nextContact: Contact | null = null;
      if (c) {
        nextContact = contactAfterMessage(c, m, now);
        await store.put("contacts", nextContact);
      }
      setState((p) => ({ ...p, messages: upsertLocal(p.messages, m), contacts: nextContact ? upsertLocal(p.contacts, nextContact) : p.contacts }));
      await log(action, "outreachMessage", m.id, c?.fullName ?? "");
    };

    return {
      ...state,
      selectedCv: state.cvs.find((c) => c.id === state.settings?.selectedCvId) ?? state.cvs[0] ?? null,
      reload,
      saveContact,
      saveMessage,

      async setClassification(ids, status) {
        const now = nowIso();
        const changed = state.contacts.filter((c) => ids.includes(c.id)).map((c) => ({ ...c, classificationStatus: status, reviewStatus: "reviewed" as const, updatedAt: now }));
        await store.putMany("contacts", changed);
        setState((p) => ({ ...p, contacts: p.contacts.map((c) => changed.find((x) => x.id === c.id) ?? c) }));
        await log("classification_changed", "contact", ids.length === 1 ? (ids[0] ?? "") : "bulk", `${status} × ${ids.length}`);
      },

      async applyImport(plan, fileName) {
        const all = [...plan.toCreate, ...plan.toUpdate];
        await store.putMany("contacts", all);
        setState((p) => {
          const map = new Map(p.contacts.map((c) => [c.id, c]));
          all.forEach((c) => map.set(c.id, c));
          return { ...p, contacts: [...map.values()] };
        });
        await log("contacts_imported", "import", fileName, `new ${plan.toCreate.length}, updated ${plan.toUpdate.length}, unchanged ${plan.unchanged}, duplicates ${plan.duplicatesInFile}, invalid ${plan.invalid.length}`);
      },

      async reclassify() {
        const now = nowIso();
        const changed = state.contacts
          .map((c) => applyClassification(c, keywords()))
          .filter((c, i) => c !== state.contacts[i])
          .map((c) => ({ ...c, updatedAt: now }));
        // only persist when something actually differs (idempotent)
        const really = changed.filter((c) => {
          const old = state.contacts.find((x) => x.id === c.id);
          return !old || old.classificationStatus !== c.classificationStatus || old.matchReason !== c.matchReason || old.matchedKeywords.join() !== c.matchedKeywords.join();
        });
        if (really.length) {
          await store.putMany("contacts", really);
          setState((p) => ({ ...p, contacts: p.contacts.map((c) => really.find((x) => x.id === c.id) ?? c) }));
        }
        await log("contacts_reclassified", "contact", "bulk", `${really.length} changed`);
        return really.length;
      },

      async loadDemo() {
        const demoContacts = buildDemoContacts(uid, keywords(), nowIso());
        await store.putMany("contacts", demoContacts);
        setState((p) => {
          const map = new Map(p.contacts.map((c) => [c.id, c]));
          demoContacts.forEach((c) => { if (!map.has(c.id)) map.set(c.id, c); });
          return { ...p, contacts: [...map.values()] };
        });
        await log("demo_data_loaded", "contact", "demo", `${demoContacts.length}`);
      },

      async removeDemo() {
        const demoIds = state.contacts.filter((c) => c.isDemo).map((c) => c.id);
        const msgIds = state.messages.filter((m) => demoIds.includes(m.contactId)).map((m) => m.id);
        await store.removeMany("contacts", uid, demoIds);
        await store.removeMany("outreachMessages", uid, msgIds);
        setState((p) => ({ ...p, contacts: p.contacts.filter((c) => !c.isDemo), messages: p.messages.filter((m) => !msgIds.includes(m.id)) }));
        await log("demo_data_removed", "contact", "demo", `${demoIds.length}`);
      },

      async prepareMessages(contactIds, templateId, method) {
        const tpl = state.templates.find((t) => t.id === templateId);
        if (!tpl) throw new Error("template_not_found");
        const now = nowIso();
        const cvId = state.settings?.selectedCvId ?? state.cvs[0]?.id ?? null;
        const campaign: OutreachCampaign = { id: newId("camp"), ownerId: uid, name: `Campaign ${now.slice(0, 16).replace("T", " ")}`, templateId, cvDocumentId: cvId, contactCount: 0, createdAt: now, updatedAt: now };
        const created: OutreachMessage[] = [];
        let reused = 0;
        let skippedContacted = 0;
        const updatedContacts: Contact[] = [];
        for (const id of contactIds) {
          const c = contactOf(id);
          if (!c) continue;
          // Never prepare a new message for someone who was already contacted.
          if (hasBeenContacted(c)) { skippedContacted++; continue; }
          if (state.messages.some((m) => m.contactId === id && m.status === "draft")) { reused++; continue; }
          const rendered = renderTemplate(tpl.body, { firstName: extractFirstName(c.firstName, c.fullName), lastName: c.lastName, fullName: c.fullName, company: c.company, jobTitle: c.jobTitle, ...sender() });
          created.push({
            id: newId("msg"), ownerId: uid, contactId: id, campaignId: campaign.id, templateId, renderedMessage: rendered.text, status: "draft", sendingMethod: method,
            cvDocumentId: cvId, confirmationMethod: null, createdAt: now, updatedAt: now, sentAt: null, responseRecordedAt: null, errorMessage: null,
          });
          if (c.outreachStatus === "not_contacted" || c.outreachStatus === "skipped") updatedContacts.push({ ...c, outreachStatus: "draft_prepared", updatedAt: now });
        }
        if (created.length) {
          campaign.contactCount = created.length;
          await store.put("outreachCampaigns", campaign);
          await store.putMany("outreachMessages", created);
          if (updatedContacts.length) await store.putMany("contacts", updatedContacts);
          setState((p) => ({
            ...p, campaigns: [...p.campaigns, campaign], messages: [...p.messages, ...created],
            contacts: p.contacts.map((c) => updatedContacts.find((x) => x.id === c.id) ?? c),
          }));
          await log("messages_prepared", "campaign", campaign.id, `${created.length}`);
        }
        return { created: created.length, reused, skippedContacted };
      },

      async rerender(messageId) {
        const m = messageOf(messageId);
        const c = m && contactOf(m.contactId);
        const tpl = m && state.templates.find((t) => t.id === m.templateId);
        if (!m || !c || !tpl) return;
        const r = renderTemplate(tpl.body, { firstName: extractFirstName(c.firstName, c.fullName), lastName: c.lastName, fullName: c.fullName, company: c.company, jobTitle: c.jobTitle, ...sender() });
        await saveMessage({ ...m, renderedMessage: r.text });
      },

      async markSent(messageId, confirmed, finalText) {
        const found = messageOf(messageId);
        if (!found) throw new Error("not_found");
        const m = finalText !== undefined ? { ...found, renderedMessage: finalText } : found;
        const next = markMessageSent(m, { confirmed, now: nowIso() });
        if (next === found) return; // idempotent
        await commit(next, "message_marked_sent");
      },
      async skip(messageId) {
        const m = messageOf(messageId);
        if (!m) return;
        const next = skipMessage(m, nowIso());
        if (next !== m) await commit(next, "message_skipped");
      },
      async reopen(messageId) {
        const m = messageOf(messageId);
        if (!m) return;
        const next = reopenMessage(m, nowIso());
        if (next !== m) await commit(next, "message_reopened");
      },
      async reply(messageId) {
        const m = messageOf(messageId);
        if (!m) return;
        const next = recordReply(m, nowIso());
        if (next !== m) await commit(next, "reply_recorded");
      },

      async saveTemplate(t) {
        const next = { ...t, updatedAt: nowIso() };
        await store.put("messageTemplates", next);
        setState((p) => ({ ...p, templates: upsertLocal(p.templates, next) }));
        await log("template_saved", "template", t.id, t.name);
      },
      async deleteTemplate(id) {
        if (state.templates.length <= 1) throw new Error("last_template");
        await store.remove("messageTemplates", uid, id);
        const remaining = state.templates.filter((t) => t.id !== id);
        setState((p) => ({ ...p, templates: remaining }));
        if (state.settings?.defaultTemplateId === id) {
          const first = remaining[0];
          if (first) {
            const next = { ...first, isDefault: true };
            await store.put("messageTemplates", next);
            const s = { ...state.settings, defaultTemplateId: first.id, updatedAt: nowIso() };
            await store.put("userSettings", s);
            setState((p) => ({ ...p, settings: s, templates: p.templates.map((t) => (t.id === first.id ? next : t)) }));
          }
        }
        await log("template_deleted", "template", id);
      },
      async setDefaultTemplate(id) {
        const now = nowIso();
        const next = state.templates.map((t) => ({ ...t, isDefault: t.id === id, updatedAt: t.isDefault !== (t.id === id) ? now : t.updatedAt }));
        await store.putMany("messageTemplates", next);
        const s = { ...(state.settings as UserSettings), defaultTemplateId: id, updatedAt: now };
        await store.put("userSettings", s);
        setState((p) => ({ ...p, templates: next, settings: s }));
        await log("default_template_changed", "template", id);
      },

      async saveSettings(patch, logText) {
        if (!state.settings) return;
        const next = { ...state.settings, ...patch, updatedAt: nowIso() };
        await store.put("userSettings", next);
        setState((p) => ({ ...p, settings: next }));
        if (logText) await log(logText, "settings", uid);
      },

      async uploadCv(file) {
        const cv = await uploadCvFile({ demo, ownerId: uid, file, previous: state.cvs[0] ?? null });
        setState((p) => ({ ...p, cvs: [cv] }));
        if (state.settings) {
          const s = { ...state.settings, selectedCvId: cv.id, updatedAt: nowIso() };
          await store.put("userSettings", s);
          setState((p) => ({ ...p, settings: s }));
        }
        await log(state.cvs.length ? "cv_replaced" : "cv_uploaded", "cv", cv.id, cv.fileName);
      },
      async removeCv(cv) {
        await deleteCv({ demo, ownerId: uid, cv });
        setState((p) => ({ ...p, cvs: p.cvs.filter((c) => c.id !== cv.id) }));
        if (state.settings?.selectedCvId === cv.id) {
          const s = { ...state.settings, selectedCvId: null, updatedAt: nowIso() };
          await store.put("userSettings", s);
          setState((p) => ({ ...p, settings: s }));
        }
        await log("cv_deleted", "cv", cv.id, cv.fileName);
      },
    } as DataState;
  }, [uid, state, demo, log, reload]);

  if (!api) return <Ctx.Provider value={null}>{children}</Ctx.Provider>;
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useData(): DataState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData must be used inside DataProvider with a signed-in user");
  return v;
}
