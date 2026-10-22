import React, { useEffect, useMemo, useState } from "react";
import {
  House,
  Users,
  CalendarBlank,
  CalendarCheck,
  ChartBar,
  Gear,
  SquaresFour,
  MagnifyingGlass,
  X,
  Plus,
  CheckCircle,
  WarningCircle,
  ArrowClockwise,
  SignOut,
  Download,
  UploadSimple,
  List,
  Stethoscope,
  MapPin,
  UsersThree,
  Trash,
  FloppyDisk,
  ClockCounterClockwise,
  LockKey,
  ArrowLeft,
  Check,
  FileXls,
  Target,
} from "@phosphor-icons/react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
} from "firebase/auth";
import { auth, request, resolveLogin } from "./firebase";
import { EMPTY_SPECIALTY, directoryKeys, reportKeys, matchingRows, facetOptions, selectedOptions } from "./data/cascading-filters";
import { activityCountsByCustomer, isDoctorClient, hasCustomerActivity } from "./data/activity-presence";
import { groupBySpecialty } from "./data/specialty-report";
import {withHonorariumParticipants} from "./data/cost-items";
import { TeamActivityDialog } from "./components/TeamActivityDialog";
import { ActualTracking } from "./components/ActualTracking";
import { Standalone } from "./components/Standalone";
import { IncomingExpenses } from "./components/IncomingExpenses";
import { demoData } from "./demo";
import {downloadLocalDirectory} from "./data/customer-cache.js";
import {
  equally,
  weighted,
  validateActivity,
  charges,
  cents,
} from "./data/domain";
import { columns, downloadWorkbook } from "./files";
import { downloadRosterTemplate, readRosterTemplate } from "./roster-template";
const money = (n) =>
  new Intl.NumberFormat(`en-US`, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((n || 0) / 100);
const statusText = { planned: `مخطط`, executed: `منفذ`, cancelled: `ملغي` };
const roleText = {
  admin: `مسؤول النظام`,
  manager: `مدير التسويق`,
  team: `حساب الفريق`,
};
const routes = [
  { id: `dashboard`, title: `لوحة التحكم`, icon: House },
  { id: `distribution`, title: `العملاء / توزيع الأنشطة`, icon: Users },
  { id: `activities`, title: `الأنشطة`, icon: CalendarBlank },
  { id: `standalone`, title: `Stand Alone`, icon: Target },
  { id: `actuals`, title: `الفعلي والمتابعة`, icon: CheckCircle },
  { id: `incoming`, title: `مصاريف الفرق الواردة`, icon: UsersThree },
  { id: `reports`, title: `التقارير`, icon: ChartBar },
  { id: `admin`, title: `الإدارة`, icon: Gear },
];
const isDemo = new URLSearchParams(location.search).get(`demo`) === `1`;
const inputMoney = (v) => (v === `` ? null : cents(v));
const defaultDraft = () => ({
  id: null,
  type: ``,
  total: 0,
  actual: null,
  status: `planned`,
  date: ``,
  notes: ``,
  clients: [],
  teamShares: [],
  honorariumShares: [],
  costItems: [
    {id:crypto.randomUUID(),category:"client",label:"Honorarium / أتعاب الأطباء",amount:0},
    {id:crypto.randomUUID(),category:"meal",label:"غداء / ضيافة",amount:0},
  ],
});
/** A single activity indicator used wherever the doctor is named. */
function ClientName({ client, activityCounts, customerKinds }) {
  if (!client) return null;
  const count = activityCounts.get(String(client.code)) || 0;
  const doctor = isDoctorClient(client, customerKinds?.get(String(client.code)));
  return (
    <span className="client-name-with-activity">
      <span>{client.name}</span>
      {doctor && count > 0 && (
        <span
          className="client-activity-indicator"
          role="img"
          title={`لديه ${count} نشاط مسجل`}
          aria-label={`لديه ${count} نشاط مسجل`}
        >
          <CalendarCheck size={15} weight="fill" aria-hidden="true" />
        </span>
      )}
    </span>
  );
}
function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Checkbox({ type, ...props }) {
  return (
    <span className="checkbox-wrap">
      <input {...props} type="checkbox" />
      {props.checked && <Check size={14} weight="bold" />}
    </span>
  );
}
function AnimatedMoney({ value }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (matchMedia(`(prefers-reduced-motion: reduce)`).matches) {
      setShown(value);
      return;
    }
    const start = performance.now(),
      from = shown;
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 350);
      setShown(Math.round(from + (value - from) * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span dir="ltr">${money(shown)}</span>;
}
function AmountInput({ value, onChange, ...props }) {
  const [raw, setRaw] = useState(value ?? ``),
    [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setRaw(value ?? ``);
  }, [value, focused]);
  return (
    <input
      {...props}
      type="number"
      value={raw}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setRaw(value ?? ``);
      }}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange?.(e);
      }}
    />
  );
}
function Badge({ status }) {
  return (
    <span className={`badge ${status}`}>{statusText[status] || status}</span>
  );
}
function Empty({ text, children }) {
  return (
    <div className="empty">
      <Users size={35} />
      <h3>{text}</h3>
      {children}
    </div>
  );
}
function Login({ onError, loading }) {
  const [username, setUsername] = useState(``),
    [password, setPassword] = useState(``),
    [remember, setRemember] = useState(false),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await setPersistence(
        auth,
        remember ? browserLocalPersistence : browserSessionPersistence,
      );
      await signInWithEmailAndPassword(
        auth,
        await resolveLogin(username),
        password,
      );
    } catch (e) {
      onError(
        [`auth/invalid-credential`,`auth/invalid-login-credentials`,`auth/wrong-password`,`auth/user-not-found`,`auth/invalid-email`].includes(e.code)
          ? `اسم المستخدم أو كلمة المرور غير صحيحة. تأكد من الحساب الفعّال بعد إعادة تعيين كلمة المرور`
          : e.code===`auth/too-many-requests`?`محاولات تسجيل كثيرة؛ حاول لاحقاً أو اطلب من الأدمن إعادة تعيين الحساب`
          : e.code===`auth/user-disabled`?`هذا الحساب معطل، راجع الأدمن`
          : e.code===`auth/network-request-failed`?`تعذر الاتصال بخدمة تسجيل الدخول؛ افحص الاتصال وأعد المحاولة`
          : e.code===`auth/unauthorized-domain`?`يجب إضافة نطاق الموقع إلى Authorized domains في Firebase`
          : `تعذر تسجيل الدخول (${e.code||"unknown"}). ${e.message}`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-screen">
      <section className="login-brand">
        <b>Dar Al Dawa</b>
        <span>خطة الأنشطة الطبية</span>
        <h1>
          تخطيط أوضح
          <br />
          وتوزيع أدق للميزانية
        </h1>
        <p>مساحة موحدة للعملاء والفرق والأنشطة الطبية لعام 2027</p>
      </section>
      <form className="login-form" onSubmit={submit}>
        <span className="eyebrow">دار الدواء • 2027</span>
        <h2>تسجيل الدخول</h2>
        <p>ادخل بيانات الحساب الذي أنشأه مسؤول النظام</p>
        <Field label="اسم المستخدم">
          <input
            autoComplete="username"
            dir="ltr"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </Field>
        <Field label="كلمة المرور">
          <input
            type="password"
            dir="ltr"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <label className="check-line">
          <Checkbox
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          تذكرني على هذا الجهاز
        </label>
        <button className="primary" disabled={busy || loading}>
          <LockKey size={19} />
          {busy ? `جار الدخول…` : `دخول النظام`}
        </button>
        <a className="demo-link" href="setup.html">تهيئة المسؤول الأول ونشر القواعد</a>
        <a className="demo-link" href="?demo=1">
          استعراض تجريبي منفصل — دون تعديل بيانات Firebase
        </a>
        <small>إنشاء الحسابات وإعادة تعيين كلمة المرور من خلال Admin</small>
      </form>
    </main>
  );
}
export function App() {
  const [data, setData] = useState(isDemo ? demoData() : null),
    [user, setUser] = useState(isDemo ? { uid: `demo` } : null),
    [ready, setReady] = useState(isDemo),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState(``),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(null),
    [page, setPage] = useState(
      location.pathname.endsWith(`admin.html`) ? `admin` : `distribution`,
    ),
    [nav, setNav] = useState(false),
    [draft, setDraft] = useState(null),
    [confirm, setConfirm] = useState(null),
    [confirmText, setConfirmText] = useState(``),
    [archiveProgress, setArchiveProgress] = useState(``),
    [audit, setAudit] = useState(null),
    [picker, setPicker] = useState(false),
    [pickerSearch, setPickerSearch] = useState(``);
  const [filters, setFilters] = useState({
      search: ``,
      team: ``,
      specialty: ``,
      area: ``,
      classification: ``,
      kind: ``,
      activity: ``,
    }),
    [pageNo, setPageNo] = useState(1),
    [expandedDirectory, setExpandedDirectory] = useState(false);
  function notify(message, type = `error`) {
    setToast({ message, type });
  }
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 7000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function reload() {
    setLoading(true);
    setLoadError(``);
    try {
      const d = await request(`load`);
      setData(d);
    } catch (e) {
      setLoadError(e.message);
      notify(
        `تعذر تحميل البيانات: ${e.message}. تأكد من نشر القواعد الجديدة وتفعيل ملف حسابك في Firestore`,
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (isDemo) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
      if (u) reload();
      else setData(null);
    });
  }, []);
  useEffect(() => {
    setPageNo(1);
    setExpandedDirectory(false);
  }, [filters]);
  useEffect(()=>{
    if(data?.visibilityHidden&&data.teams.length===1){
      const only=data.teams[0].id;
      setFilters(f=>f.team===only?f:{...f,team:only,classification:""});
    }
  },[data?.visibilityHidden,data?.teams]);
  const directoryPageSize=50;
  const manager = data && [`admin`, `manager`].includes(data.profile.role);
  const allowed = routes.filter((r) => (r.id !== `admin` || manager) && (r.id !== `standalone` || data?.profile.role !== `manager`));
  const activityCounts = useMemo(
    () => activityCountsByCustomer(data?.activities || []),
    [data?.activities],
  );
  const customerKinds = useMemo(
    () => new Map((data?.customers || []).map(c => [String(c.code), c.kind])),
    [data?.customers],
  );
  const selectedTeam = data?.teams.find((t) => t.id === filters.team);
  const rosterMap = useMemo(
    () =>
      new Map(
        (data?.rosters || []).map((r) => [
          r.teamId,
          new Map(r.rows.map((c) => [c.code, c])),
        ]),
      ),
    [data],
  );
  const directoryRows = useMemo(() => {
    if (!data) return [];
    const affiliations = new Map();
    for (const roster of data.rosters)
      for (const c of roster.rows) {
        const entries = affiliations.get(c.code) || [];
        entries.push({team: roster.teamId, classification: c.classification || ``});
        affiliations.set(c.code, entries);
      }
    return data.customers.flatMap(c => {
      const base = {
        code: c.code, specialty: c.specialty || ``, area: c.area || ``, kind: c.kind || ``,
        activity: hasCustomerActivity(activityCounts, c.code) ? `with` : `without`,
        searchText: `${c.name} ${c.code}`.toLocaleLowerCase(),
      };
      return (affiliations.get(c.code) || [{team: ``,classification: ``}])
        .map(member => ({...base,...member}));
    });
  }, [data, activityCounts]);
  const searchedDirectory = useMemo(() => {
    const search = filters.search.trim().toLocaleLowerCase();
    return search ? directoryRows.filter(row => row.searchText.includes(search)) : directoryRows;
  }, [directoryRows, filters.search]);
  const directoryOptions = useMemo(() =>
    Object.fromEntries([`team`,`specialty`,`area`,`classification`,`activity`].map(key=>[
      key,
      selectedOptions(facetOptions(searchedDirectory, filters, directoryKeys, key),filters[key]),
    ])), [searchedDirectory,filters]);
  const visible = useMemo(() => {
    if(!data) return [];
    const codes = new Set(matchingRows(searchedDirectory, filters, directoryKeys).map(row=>row.code));
    return data.customers.filter(c=>codes.has(c.code));
  }, [data,searchedDirectory,filters]);
  function changeFilter(key, value) {
    setFilters((f) => ({
      ...f,
      [key]: value,
      ...(key === `team` ? { classification: `` } : {}),
    }));
  }
  const eligible = (c) => {
    if(data.visibilityHidden){
      return data.sharedTeamsByCustomer?.[String(c.code)]||data.teams.filter(t=>rosterMap.get(t.id)?.has(c.code));
    }
    return data.teams.filter(t=>rosterMap.get(t.id)?.has(c.code));
  };
  const activityTeamOptions = data?.visibilityHidden
    ? [...new Map([...data.teams,...Object.values(data.sharedTeamsByCustomer||{}).flat()].map(t=>[t.id,t])).values()]
    : data?.teams||[];
  const canManageCustomers = data?.profile.role === `admin` && !isDemo;
  const hasDirectoryFilter = Object.values(filters).some(value => String(value||``).trim());
  function openCustomerArchive(customers){
    if(!canManageCustomers || !customers.length) return;
    const selected=customers.map(c=>({code:c.code,name:c.name,specialty:c.specialty||``,area:c.area||``}));
    const bulk=selected.length>1;
    setConfirmText(``);
    setConfirm({
      title:bulk ? `حذف ${selected.length} عميل من قوائم الفرق؟` : `حذف ${selected[0].name}؟`,
      text:`سيختفي هؤلاء العملاء من جميع الفرق، ولن يكونوا متاحين للأنشطة الجديدة. الأنشطة السابقة والميزانيات محفوظة. ${bulk ? `يمكن إعادة العملاء فقط عبر رفع قائمة جديدة، وقد يتطلب الحذف عدة دفعات.` : `يمكن إعادة العميل لاحقا عن طريق القالب.`}`,
      requiresText:bulk,
      action:async()=>{
        let completed=0;
        try{
          for(let i=0;i<selected.length;i+=10){
            await request(`archiveCustomers`,{rows:selected.slice(i,i+10)});
            completed=Math.min(i+10,selected.length);
            setArchiveProgress(`تم حذف ${completed} من ${selected.length} عميل`);
          }
          setDraft(null);
          notify(`تم حذف ${completed} عميل من قوائم الفرق، مع الاحتفاظ بسجل الأنشطة`,`success`);
        }catch(e){
          notify(`تم حذف ${completed} من ${selected.length} عميل قبل توقف العملية. ${e.message}`);
          throw e;
        }finally{
          setArchiveProgress(``);
          await reload();
        }
      },
    });
  }
  function selectClient(c) {
    const current=draft||defaultDraft();
    if(current.clients.some(x=>x.code===c.code)){
      setDraft(withHonorariumParticipants(current,current.clients.filter(x=>x.code!==c.code)));
      return;
    }
    if(!manager&&!rosterMap.get(data.profile.teamId)?.has(c.code)){
      notify(`يمكنك استعراض العميل، لكن إنشاء النشاط متاح لعملاء فريقك فقط`);
      return;
    }
    if(current.clients.length>=8){notify(`النشاط الواحد يدعم حتى 8 عملاء`);return;}
    let teamShares=current.teamShares||[];
    if(!manager){
      const team=data.teams.find(t=>t.id===data.profile.teamId);
      if(team&&!teamShares.some(s=>s.teamId===team.id)){
        const next=[...teamShares,{teamId:team.id,teamName:team.name,amount:0,actual:current.actual===null?null:0}];
        const amounts=equally(current.total,next.length);
        teamShares=next.map((s,i)=>({...s,amount:amounts[i]}));
      }
    }
    setDraft(withHonorariumParticipants({...current,teamShares},[...current.clients,{code:c.code,name:c.name,kind:c.kind||``,specialty:c.specialty||``,area:c.area||``}]));
  }
  async function perform(op, payload, message) {
    if (isDemo) {
      setData((d) => {
        const n = structuredClone(d);
        if (op === `saveActivity` || op === `deleteActivity`) {
          const prev = n.activities.find((a) => a.id === payload.id),
            next =
              op === `saveActivity`
                ? {
                    ...payload,
                    id: payload.id || `demo-${Date.now()}`,
                    creator: prev?.creator || `demo`,
                    year: 2027,
                    createdAt: prev?.createdAt || Date.now(),
                  }
                : null;
          const before = charges(prev),
            after = charges(next);
          n.teams = n.teams.map((t) => ({
            ...t,
            used: t.used - (before[t.id] || 0) + (after[t.id] || 0),
          }));
          n.activities = n.activities.filter((a) => a.id !== payload.id);
          if (next) n.activities.unshift(next);
        }
        if (op === `saveTeam`) {
          const prev = n.teams.find((t) => t.id === payload.id);
          if (prev) Object.assign(prev, payload);
          else
            n.teams.push({
              ...payload,
              id: `demo-team-${Date.now()}`,
              used: 0,
            });
        }
        if (op === `saveTypes`) n.settings.types = payload.types;
        return n;
      });
      notify(`${message} — في المعاينة فقط`, `success`);
      return;
    }
    await request(op, payload);
    await reload();
    notify(message, `success`);
  }
  function toTeamDraft(activity){
    return {
      ...structuredClone(activity),
      clients:activity.clients.map(c=>({
        code:c.code,name:c.name,kind:c.kind||``,specialty:c.specialty||``,area:c.area||``,
      })),
      teamShares:structuredClone(activity.teamShares||[]),
      costItems:structuredClone(activity.costItems||[]),
      honorariumShares:structuredClone(activity.honorariumShares||[]),
    };
  }
  async function persistActivity(value,closeDialog=false) {
    try{
      const normalized=Array.isArray(value.costItems)?{...value,costItems:value.costItems.filter(item=>item.amount>0)}:value;
      validateActivity(normalized);
      const old=data.activities.find(a=>a.id===value.id);
      const before=charges(old),after=charges(normalized);
      for(const t of data.teams){
        if(t.used-(before[t.id]||0)+(after[t.id]||0)>t.budget||
          (normalized.actual!==null && t.used-(before[t.id]||0)+
           (charges({...normalized,status:`executed`})[t.id]||0)>t.budget))
          throw new Error(`ميزانية ${t.name} لا تكفي؛ يرجى تعديل ميزانية الفريق`);
      }
      setBusy(true);
      await perform(`saveActivity`,normalized,`تم حفظ النشاط وتحديث الميزانيات`);
      if(closeDialog)setDraft(null);
    }catch(e){
      notify(e.message);
      throw e;
    }finally{setBusy(false);}
  }
  function openActivity(activity){setDraft(toTeamDraft(activity));}
  const canEditActivity=activity=>Boolean(
    manager || (activity.creator===(data?.profile.accountId||user?.uid) &&
      (!data.visibilityHidden || activity.teamIds?.length===1))
  );
  async function exportExcel() {
    setBusy(true);
    try {
      await downloadWorkbook(data);
      notify(`تم تجهيز ملف Excel الشامل`, `success`);
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function showAudit() {
    try {
      if (isDemo) setAudit([]);
      else setAudit((await request(`audit`)).rows);
    } catch (e) {
      notify(e.message);
    }
  }
  if (!ready)
    return (
      <main className="loading-screen">
        <span className="spinner" />
        جار تجهيز النظام…
      </main>
    );
  if (!user)
    return (
      <>
        <Login onError={notify} loading={loading} />
        {toast && <Toast toast={toast} close={() => setToast(null)} />}
      </>
    );
  if (!data)
    return (
      <main className="loading-screen">
        <h2>Dar Al Dawa</h2>
        {loading ? (
          <>
            <span className="spinner" />
            جار تحميل بيانات الحساب…
          </>
        ) : (
          <>
            <p>تعذر تحميل النظام</p>
            <p role="alert" style={{maxWidth: `640px`, padding: `0 20px`, lineHeight: 1.9, overflowWrap: `anywhere`}}>{loadError || `اضغط إعادة المحاولة لعرض سبب الخطأ`}</p>
            <button className="primary" onClick={reload}>
              إعادة المحاولة
            </button>
            <button onClick={() => signOut(auth)}>تسجيل الخروج</button>
          </>
        )}
        {toast && <Toast toast={toast} close={() => setToast(null)} />}
      </main>
    );
  const oldDraft = data.activities.find((a) => a.id === draft?.id),
    canEdit = draft && (manager || !draft.id ||
      (draft.creator === (data.profile.accountId || user.uid) &&
       (!data.visibilityHidden || oldDraft?.teamIds?.length===1)));
  return (
    <div className="app">
      <aside className={`sidebar ${nav ? `mobile-open` : ``}`}>
        <div className="brand">
          Dar Al Dawa<span>تخطيط الأنشطة الطبية</span>
        </div>
        <button
          className="mobile-close icon-button"
          onClick={() => setNav(false)}
          aria-label="إغلاق القائمة"
        >
          <X />
        </button>
        <nav>
          {allowed.map((r) => (
            <button
              key={r.id}
              className={page === r.id ? `active` : ``}
              onClick={() => {
                setPage(r.id);
                setNav(false);
              }}
            >
              <r.icon size={21} />
              <span>{r.title}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span>السنة التخطيطية</span>
          <strong>2027</strong>
          <small>جميع المبالغ بالدولار الأمريكي</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            onClick={() => setNav(true)}
            aria-label="القائمة"
          >
            <List size={25} />
          </button>
          <div>
            <h1>{routes.find((r) => r.id === page)?.title}</h1>
            <div className="breadcrumb">
              الرئيسية <span>/</span> {routes.find((r) => r.id === page)?.title}
            </div>
          </div>
          <div className="top-actions">
            <span className="year-pill">
              2027 <CalendarBlank size={17} />
            </span>
            <div className="profile">
              <b>{data.profile.name}</b>
              <small>{roleText[data.profile.role]}</small>
            </div>
            <button
              className="icon-button"
              title="تحديث البيانات"
              aria-label="تحديث البيانات"
              onClick={() =>
                isDemo ? notify(`هذه بيانات تجريبية`, `success`) : reload()
              }
              disabled={loading}
            >
              <ArrowClockwise size={20} className={loading ? `spin` : ``} />
            </button>
            <button
              className="icon-button"
              title="تسجيل الخروج"
              aria-label="تسجيل الخروج"
              onClick={() =>
                isDemo ? location.assign(location.pathname) : signOut(auth)
              }
            >
              <SignOut size={20} />
            </button>
          </div>
        </header>
        {isDemo && (
          <div className="demo-banner">
            معاينة تفاعلية ببيانات توضيحية • التعديلات مؤقتة ولا تصل إلى
            Firebase{" "}
            <a href={location.pathname}>
              العودة لتسجيل الدخول <ArrowLeft size={14} />
            </a>
          </div>
        )}
        <main className="main-content">
          {page === `distribution` && (
            <>
              <section className="filter-bar">
                <div className="search">
                  <MagnifyingGlass size={20} />
                  <input
                    aria-label="البحث عن عميل"
                    placeholder="ابحث باسم العميل أو الكود"
                    value={filters.search}
                    onChange={(e) => changeFilter(`search`, e.target.value)}
                  />
                </div>
                <Field label="الفريق">
                  <select
                    value={filters.team}
                    onChange={(e) => changeFilter(`team`, e.target.value)}
                  >
                    {!data.visibilityHidden && <option value="">جميع الفرق</option>}
                    {data.teams.filter(t => directoryOptions.team.includes(t.id)).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="التخصص">
                  <select
                    value={filters.specialty}
                    onChange={(e) => changeFilter(`specialty`, e.target.value)}
                  >
                    <option value="">جميع التخصصات</option>
                    {directoryOptions.specialty.map((v) => (
                      <option key={v} value={v}>{v === EMPTY_SPECIALTY ? `بدون تخصص` : v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="المنطقة">
                  <select
                    value={filters.area}
                    onChange={(e) => changeFilter(`area`, e.target.value)}
                  >
                    <option value="">جميع المناطق</option>
                    {directoryOptions.area.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="التصنيف">
                  <select
                    disabled={!filters.team}
                    value={filters.classification}
                    onChange={(e) =>
                      changeFilter(`classification`, e.target.value)
                    }
                  >
                    <option value="">
                      {filters.team ? `جميع التصنيفات` : `اختر فريقا أولا`}
                    </option>
                    {directoryOptions.classification
                      .map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                  </select>
                </Field>
                <Field label="Activity">
                  <select
                    aria-label="فلتر العملاء حسب وجود نشاط"
                    value={filters.activity}
                    onChange={(e) => changeFilter(`activity`, e.target.value)}
                  >
                    <option value="">جميع العملاء</option>
                    {directoryOptions.activity.includes(`with`) && (
                      <option value="with">لديهم Activity</option>
                    )}
                    {directoryOptions.activity.includes(`without`) && (
                      <option value="without">بدون Activity</option>
                    )}
                  </select>
                </Field>
              </section>
              <section className="directory">
                <div className="section-heading">
                  <div>
                    <h2>
                      العملاء <span className="count">{visible.length}</span>
                    </h2>
                    <p>اختر عميلا أو أكثر لإنشاء نشاط وتوزيع ميزانيته</p>
                    <small className="activity-legend"><CalendarCheck size={14} weight="fill" aria-hidden="true" /> أيقونة التقويم: الطبيب لديه Activity مسجلة</small>
                  </div>
                  <div className="directory-actions">
                    {canManageCustomers && (
                      <button type="button" className="danger-text archive-bulk-button"
                        disabled={busy || !hasDirectoryFilter || !visible.length}
                        title={!hasDirectoryFilter ? `اختر فلتر أو ابحث عن عميل قبل الحذف` : `حذف كل النتائج المطابقة من جميع الفرق`}
                        onClick={()=>openCustomerArchive(visible)}>
                        <Trash size={17}/> حذف نتائج الفلاتر ({visible.length})
                      </button>
                    )}
                    <button type="button" className="text-button" onClick={()=>{
                      downloadLocalDirectory(visible);notify(`تم تنزيل قائمة العملاء المعروضة (${visible.length}) بصيغة CSV`,`success`);
                    }}><Download size={17}/> تنزيل القائمة للجهاز</button>
                    <button className="text-button" onClick={() => {
                      setFilters({
                        search:``,team:data.visibilityHidden&&data.teams.length===1?data.teams[0].id:``,
                        specialty:``,area:``,classification:``,kind:``,activity:``,
                      });
                    }}>
                      مسح الفلاتر
                    </button>
                  </div>
                </div>
                <div className="table-wrap customer-table">
                  <table>
                    <thead>
                      <tr>
                        <th className="select-col"></th>
                        <th>كود العميل</th>
                        <th>اسم العميل</th>
                        <th>التخصص</th>
                        <th>المنطقة</th>
                        <th>
                          {selectedTeam ? `تصنيف الفريق` : `الفرق الزائرة`}
                        </th>
                        {canManageCustomers && <th className="customer-admin-col">الإدارة</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {visible
                        .slice(expandedDirectory?0:(pageNo-1)*directoryPageSize,expandedDirectory?undefined:pageNo*directoryPageSize)
                        .map((c) => {
                          const selected = draft?.clients.some(
                            (x) => x.code === c.code,
                          );
                          return (
                            <tr
                              key={c.code}
                              className={selected ? `selected` : ``}
                              onClick={() => selectClient(c)}
                            >
                              <td>
                                <Checkbox
                                  type="checkbox"
                                  aria-label={`اختيار ${c.name}`}
                                  checked={Boolean(selected)}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => selectClient(c)}
                                />
                              </td>
                              <td className="code">{c.code}</td>
                              <td className="customer-name">
                                <ClientName client={c} activityCounts={activityCounts} customerKinds={customerKinds} />
                                <small className="mobile-only">
                                  {c.specialty} • {c.area}
                                </small>
                              </td>
                              <td>{c.specialty || `—`}</td>
                              <td>{c.area || `—`}</td>
                              <td>
                                {selectedTeam ? (
                                  <span className="class-badge">
                                    {rosterMap.get(filters.team)?.get(c.code)
                                      ?.classification || `—`}
                                  </span>
                                ) : (
                                  eligible(c)
                                    .map((t) => t.name)
                                    .join(`، `) || `غير مرتبط بفريق`
                                )}
                              </td>
                              {canManageCustomers && (
                                <td>
                                  <button type="button" className="danger-text customer-delete-button"
                                    disabled={busy}
                                    aria-label={`حذف ${c.name}`}
                                    onClick={(e)=>{e.stopPropagation();openCustomerArchive([c]);}}>
                                    <Trash size={16}/> حذف
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                {!visible.length && (
                  <Empty
                    text={
                      data.customers.length
                        ? `لا توجد نتائج مطابقة`
                        : `لم ترفع قوائم العملاء بعد`
                    }
                  >
                    {manager && (
                      <button onClick={() => setPage(`admin`)}>
                        الانتقال إلى الإدارة
                      </button>
                    )}
                  </Empty>
                )}
                {visible.length > 0 && (
                  <div className="pagination">
                    <span>
                      عرض {expandedDirectory?1:(pageNo-1)*directoryPageSize+1}–
                      {expandedDirectory?visible.length:Math.min(pageNo*directoryPageSize,visible.length)} من{" "}
                      {visible.length} نتيجة
                    </span>
                    <div>
                      <button type="button" className="text-button" onClick={()=>{setExpandedDirectory(v=>!v);setPageNo(1);}}>
                        {expandedDirectory?"عرض 50 لكل صفحة":"توسيع القائمة • عرض الكل"}
                      </button>
                      {!expandedDirectory&&<button
                        disabled={pageNo === 1}
                        onClick={() => setPageNo((p) => p - 1)}
                      >
                        السابق
                      </button>}
                      {!expandedDirectory&&<b>{pageNo}</b>}
                      {!expandedDirectory&&<button
                        disabled={pageNo * directoryPageSize >= visible.length}
                        onClick={() => setPageNo((p) => p + 1)}
                      >
                        التالي
                      </button>}
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
          {page === `dashboard` && (
            <Dashboard data={data} onGo={() => setPage(`distribution`)} />
          )}
          {page === `activities` && (
            <Activities data={data} onOpen={openActivity} activityCounts={activityCounts} customerKinds={customerKinds} />
          )}
          {page === `standalone` && (
            <Standalone data={data} busy={busy}
              onInit={async()=>{
                try{setBusy(true);if(isDemo){notify("هذا وضع المعاينة", "success");return;}
                  await request("standaloneInit");await reload();notify("تم تهيئة حصص Stand Alone", "success");
                }catch(e){notify(e.message);}finally{setBusy(false);}
              }}
              onChoose={async item=>{
                try{setBusy(true);if(isDemo){notify("هذا وضع المعاينة");return;}
                  await request("standaloneChoose",item);await reload();notify("تم تحديث اختيار الطبيب", "success");
                }catch(e){
                  notify(e.code==="permission-denied"?"رفض Firebase حفظ الاختيار. تأكد من نشر قواعد Firestore الجديدة، وتخصص الطبيب، وعضويته في الفريق":e.message);
                }finally{setBusy(false);}
              }}
            />
          )}
          {page === `incoming` && (
            <IncomingExpenses data={data} onOpen={openActivity}/>
          )}
          {page === `actuals` && (
            <ActualTracking data={data} busy={busy} onOpen={openActivity}
              canEditActivity={canEditActivity}
              onSave={value=>persistActivity(value,false)} />
          )}
          {page === `reports` && (
            <Reports data={data} exportExcel={exportExcel} busy={busy} activityCounts={activityCounts} customerKinds={customerKinds} />
          )}
          {page === `admin` && manager && (
            <Admin
              data={data}
              perform={perform}
              notify={notify}
              reload={reload}
              showAudit={showAudit}
              isDemo={isDemo}
              activityCounts={activityCounts}
              customerKinds={customerKinds}
            />
          )}
        </main>
      </div>
      {draft && (
        <TeamActivityDialog
          draft={draft}
          setDraft={setDraft}
          teams={activityTeamOptions}
          types={data.settings.types}
          eligible={eligible}
          canEdit={Boolean(canEdit)}
          canCancel={manager}
          busy={busy}
          onClose={()=>setDraft(null)}
          onSave={()=>persistActivity(draft,true).catch(()=>{})}
          onPick={()=>{setPickerSearch(``);setPicker(true);}}
          renderName={c=><ClientName client={c} activityCounts={activityCounts} customerKinds={customerKinds}/>}
          onDelete={oldDraft&&oldDraft.actual===null&&oldDraft.status===`planned`?()=>{
            setConfirm({
              title:`حذف النشاط؟`,
              text:`سيُعاد المبلغ المحجوز للفرق، ويُحفظ أثر العملية في سجل التغييرات`,
              action:async()=>{
                await perform(`deleteActivity`,{id:draft.id},`تم حذف النشاط وإعادة المبالغ المحجوزة`);
                setDraft(null);
              },
            });
          }:null}
        />
      )}
      {picker && (
        <div className="modal-backdrop">
          <section className="modal wide" role="dialog" aria-modal="true">
            <div className="section-heading">
              <h2>إضافة عملاء للنشاط</h2>
              <button
                className="icon-button"
                onClick={() => setPicker(false)}
                aria-label="إنهاء اختيار العملاء"
              >
                <X />
              </button>
            </div>
            <input
              autoFocus
              placeholder="ابحث بالاسم أو الكود لإضافة عميل"
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
            />
            <div className="picker-list">
              {data.customers
                .filter(
                  (c) =>
                    (manager ||
                      rosterMap.get(data.profile.teamId)?.has(c.code)) &&
                    `${c.name} ${c.code}`
                      .toLowerCase()
                      .includes(pickerSearch.toLowerCase()),
                )
                .slice(0, 100)
                .map((c) => (
                  <label className="picker-row" key={c.code}>
                    <Checkbox
                      type="checkbox"
                      checked={Boolean(
                        draft?.clients.some((x) => x.code === c.code),
                      )}
                      onChange={() => selectClient(c)}
                    />
                    <div>
                      <b><ClientName client={c} activityCounts={activityCounts} customerKinds={customerKinds} /></b>
                      <small>
                        {c.code} • {c.specialty} • {c.area}
                      </small>
                    </div>
                  </label>
                ))}
            </div>
            <button className="primary" onClick={() => setPicker(false)}>
              متابعة التوزيع ({draft?.clients.length || 0} عملاء)
            </button>
          </section>
        </div>
      )}
      {toast && <Toast toast={toast} close={() => setToast(null)} />}
      {confirm && (
        <div className="modal-backdrop">
          <section className="modal" role="dialog" aria-modal="true">
            <h2>{confirm.title}</h2>
            <p>{confirm.text}</p>
            {confirm.requiresText && (
              <Field label="للتأكيد اكتب كلمة حذف">
                <input autoFocus value={confirmText} autoComplete="off"
                  onChange={(e)=>setConfirmText(e.target.value)}
                  placeholder="حذف" aria-label="تأكيد الحذف الجماعي" />
              </Field>
            )}
            {archiveProgress && <p role="status">{archiveProgress}</p>}
            <div className="button-row">
              <button onClick={() => setConfirm(null)}>رجوع</button>
              <button
                className="primary"
                disabled={busy || (confirm.requiresText && confirmText.trim() !== `حذف`)}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await confirm.action();
                    setConfirm(null);
                  } catch (e) {
                    notify(e.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                تأكيد
              </button>
            </div>
          </section>
        </div>
      )}
      {audit && (
        <div className="modal-backdrop">
          <section className="modal wide" role="dialog" aria-modal="true">
            <div className="section-heading">
              <h2>آخر 100 تغيير</h2>
              <button
                className="icon-button"
                onClick={() => setAudit(null)}
                aria-label="إغلاق"
              >
                <X />
              </button>
            </div>
            {!audit.length ? (
              <Empty text="لا توجد تغييرات مسجلة" />
            ) : (
              <div className="audit-list">
                {audit.map((a) => (
                  <details key={a.id}>
                    <summary>
                      {{
                        saveActivity: `حفظ نشاط`,
                        deleteActivity: `حذف نشاط`,
                      archiveCustomers: `حذف عملاء من قوائم الفرق`,
                        saveTeam: `تعديل فريق أو ميزانية`,
                        saveTypes: `تعديل أنواع الأنشطة`,
                        createUser: `إنشاء مستخدم`,
                        updateUser: `تعديل مستخدم`,
                        finishImport: `اعتماد قائمة عملاء`,
                      }[a.action] || a.action}{" "}
                      <small>
                        {a.at
                          ? new Date(a.at._seconds * 1000).toLocaleString(
                              `ar-JO`,
                            )
                          : ``}
                      </small>
                    </summary>
                    <p>المستخدم: {a.uid}</p>
                    <h4>قبل التعديل</h4>
                    <pre dir="ltr">{JSON.stringify(a.before, null, 2)}</pre>
                    <h4>بعد التعديل</h4>
                    <pre dir="ltr">{JSON.stringify(a.after, null, 2)}</pre>
                  </details>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
function Toast({ toast, close }) {
  return (
    <div className={`toast ${toast.type}`} role="status">
      {toast.type === `success` ? (
        <CheckCircle size={23} />
      ) : (
        <WarningCircle size={23} />
      )}
      <span>{toast.message}</span>
      <button
        className="icon-button"
        onClick={close}
        aria-label="إغلاق الإشعار"
      >
        <X size={17} />
      </button>
    </div>
  );
}
function Dashboard({ data, onGo }) {
  const total = data.teams.reduce((s, t) => s + t.budget, 0),
    used = data.teams.reduce((s, t) => s + t.used, 0),
    planned = data.activities.filter((a) => a.status === `planned`),
    actual = data.activities.reduce((s, a) => s + (a.actual || 0), 0);
  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">نظرة شاملة • 2027</span>
          <h2>ميزانية واضحة، وقرارات أدق</h2>
          <p>المتاح يستبعد المخطط المحجوز ومصروف الأنشطة المغلقة</p>
        </div>
        <button className="primary" onClick={onGo}>
          <Plus size={19} />
          إنشاء نشاط
        </button>
      </div>
      <div className="stats-grid">
        {[
          [`الميزانية السنوية`, total],
          [`المحجوز والمصروف`, used],
          [`الميزانية المتاحة`, total - used],
          [`الفعلي المسجل للمتابعة`, actual],
        ].map(([label, value]) => (
          <div className="stat" key={label}>
            <span>{label}</span>
            <strong dir="ltr">${money(value)}</strong>
            <small>USD</small>
          </div>
        ))}
      </div>
      <section className="surface">
        <div className="section-heading">
          <h2>ميزانيات الفرق</h2>
          <span>{planned.length} نشاط مخطط</span>
        </div>
        <TeamTable teams={data.teams} dashboard />
      </section>
    </>
  );
}
function TeamTable({ teams, dashboard = false }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>الفريق</th>
            <th>الميزانية USD</th>
            <th>المحجوز والمصروف USD</th>
            <th>{dashboard ? `المتبقي من الميزانية USD` : `المتاح USD`}</th>
            <th>الاستخدام</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t) => (
            <tr key={t.id}>
              <td>
                <b dir="auto">{t.name}</b>
              </td>
              <td className="numeric">{money(t.budget)}</td>
              <td className="numeric">{money(t.used)}</td>
              <td className="numeric positive">{money(t.budget - t.used)}</td>
              <td>
                <div className="usage">
                  <span
                    style={{
                      width: `${Math.min(100, t.budget ? (t.used / t.budget) * 100 : 0)}%`,
                    }}
                  />
                </div>
                <small>
                  {t.budget ? ((t.used / t.budget) * 100).toFixed(1) : `0`}%
                </small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!teams.length && <Empty text="لم تضف فرق بعد" />}
    </div>
  );
}

function Activities({ data,onOpen,activityCounts,customerKinds }){
 const [f,setF]=useState({search:"",team:data.visibilityHidden?data.profile.teamId:"",specialty:"",area:"",classification:"",type:"",status:""});
 useEffect(()=>{
  if(data.visibilityHidden&&data.teams.length===1)setF(prev=>prev.team===data.profile.teamId?prev:{...prev,team:data.profile.teamId,classification:""});
 },[data.visibilityHidden,data.profile.teamId,data.teams.length]);
 const options=get=>[...new Set(data.activities.flatMap(get).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"ar"));
 const roster=new Map(data.rosters.map(r=>[r.teamId,new Map(r.rows.map(c=>[String(c.code),c.classification||""]))]));
 const rows=data.activities.filter(a=>{
  const clients=a.clients||[];
  if(f.team&&!a.teamIds?.includes(f.team))return false;
  if(f.status&&a.status!==f.status)return false;
  if(f.type&&a.type!==f.type)return false;
  if(f.specialty&&!clients.some(c=>c.specialty===f.specialty))return false;
  if(f.area&&!clients.some(c=>c.area===f.area))return false;
  if(f.classification&&(!f.team||!clients.some(c=>roster.get(f.team)?.get(String(c.code))===f.classification)))return false;
  const q=f.search.trim().toLocaleLowerCase();
  if(q&&!`${a.type} ${a.id} ${a.creatorTeamName||""} ${clients.map(c=>c.name+" "+c.code).join(" ")}`.toLocaleLowerCase().includes(q))return false;
  return true;
 }).sort((a,b)=>Number(b.createdAt?.seconds||b.createdAt||0)-Number(a.createdAt?.seconds||a.createdAt||0));
 const target=data.profile.role==="team"?data.profile.teamId:f.team;
 const choose=(key,value)=>setF(o=>({...o,[key]:value,...(key==="team"?{classification:""}:{})}));
 return <>
  <div className="section-heading"><div><h2>سجل الأنشطة</h2><p>اعرف إجمالي النشاط وحصة فريقك والفلاتر المعتادة</p></div><span className="count">{rows.length}</span></div>
  <div className="activity-ledger-filters">
   <label className="search"><MagnifyingGlass size={18}/><input placeholder="ابحث بالنشاط أو العميل أو الفريق" value={f.search} onChange={e=>choose("search",e.target.value)}/></label>
   <select aria-label="فلتر الفريق" value={f.team} onChange={e=>choose("team",e.target.value)}>
    {!data.visibilityHidden&&<option value="">جميع الفرق</option>}
    {data.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
   </select>
   <select aria-label="فلتر التخصص" value={f.specialty} onChange={e=>choose("specialty",e.target.value)}>
    <option value="">جميع التخصصات</option>{options(a=>a.clients.map(c=>c.specialty||"")).map(v=><option key={v}>{v}</option>)}
   </select>
   <select aria-label="فلتر المنطقة" value={f.area} onChange={e=>choose("area",e.target.value)}>
    <option value="">جميع المناطق</option>{options(a=>a.clients.map(c=>c.area||"")).map(v=><option key={v}>{v}</option>)}
   </select>
   <select aria-label="فلتر التصنيف" value={f.classification} disabled={!f.team} onChange={e=>choose("classification",e.target.value)}>
    <option value="">{f.team?"جميع التصنيفات":"اختر فريقا أولا"}</option>
    {[...new Set([...(roster.get(f.team)?.values()||[])])].filter(Boolean).sort().map(x=><option key={x}>{x}</option>)}
   </select>
   <select aria-label="فلتر نوع النشاط" value={f.type} onChange={e=>choose("type",e.target.value)}>
    <option value="">كل الأنشطة</option>{options(a=>[a.type]).map(t=><option key={t}>{t}</option>)}
   </select>
   <select aria-label="فلتر الحالة" value={f.status} onChange={e=>choose("status",e.target.value)}>
    <option value="">كل الحالات</option>{Object.entries(statusText).map(([k,v])=><option key={k} value={k}>{v}</option>)}
   </select>
   <button type="button" className="text-button" onClick={()=>setF({search:"",team:data.visibilityHidden?data.profile.teamId:"",specialty:"",area:"",classification:"",type:"",status:""})}>مسح الفلاتر</button>
  </div>
  <section className="surface"><div className="table-wrap"><table>
   <thead><tr><th>النشاط / الفريق المنشئ</th><th>العملاء</th><th>التاريخ</th><th>إجمالي النشاط USD</th>
    {target&&<th>حصة الفريق USD</th>}<th>الفعلي الإجمالي USD</th>{target&&<th>فعلي حصة الفريق USD</th>}<th>الحالة</th><th></th>
   </tr></thead>
   <tbody>{rows.map(a=>{
    const share=target?a.teamShares?.find(s=>s.teamId===target):null;
    return <tr key={a.id}>
     <td><b>{a.type}</b><small className="row-sub">{a.creatorTeamName||"الإدارة"} • {a.id.slice(-8)}</small></td>
     <td className="activity-client-names">{a.clients.map((c,i)=><React.Fragment key={`${a.id}-${c.code}`}>
      {i>0&&<span>، </span>}<ClientName client={c} activityCounts={activityCounts} customerKinds={customerKinds}/>
     </React.Fragment>)}</td>
     <td>{a.date||"غير مجدول"}</td><td className="numeric">{money(a.total)}</td>
     {target&&<td className="numeric"><b>{share?money(share.amount):"—"}</b></td>}
     <td className="numeric">{a.actual===null?"—":money(a.actual)}</td>
     {target&&<td className="numeric">{share?.actual==null?"—":money(share.actual)}</td>}
     <td><Badge status={a.status}/></td>
     <td><button type="button" className="text-button" onClick={()=>onOpen(a)}>تفاصيل</button></td>
    </tr>;
   })}</tbody>
  </table></div>{!rows.length&&<Empty text="لا توجد أنشطة تطابق الفلاتر"/>}</section>
 </>;
}
function Reports({ data, exportExcel, busy, activityCounts, customerKinds }) {
  const [view, setView] = useState(`teams`),
    [filters, setFilters] = useState({
      month: ``,
      type: ``,
      status: ``,
      team: ``,
      area: ``,
      specialty: ``,
      classification: ``,
    });
  const reportSourceRows = useMemo(() => {
    const rosters=new Map(data.rosters.map(r=>[r.teamId,new Map(r.rows.map(c=>[c.code,c.classification||``]))]));
    return data.activities.flatMap(activity=>{
      const common={month:activity.date?.slice(5,7)||`unscheduled`,type:activity.type,status:activity.status};
      if(activity.schema===3){
        const specs=[...new Set(activity.clients.map(c=>String(c.specialty||``).trim()).filter(Boolean))];
        const areas=[...new Set(activity.clients.map(c=>String(c.area||``).trim()).filter(Boolean))];
        const specialty=specs.length===0?``:specs.length===1?specs[0]:`متعدد التخصصات`;
        const area=areas.length===1?areas[0]:areas.length?`مناطق متعددة`:``;
        if(view===`customers`)
          return activity.clients.flatMap(client=>activity.teamShares.map(share=>({
            activity,client,share:{...share,amount:0,actual:0},team:share.teamId,
            specialty:client.specialty||``,area:client.area||``,
            classification:rosters.get(share.teamId)?.get(client.code)||``,unattributed:true,...common,
          })));
        return activity.teamShares.map(share=>({
          activity,client:{code:`activity-${activity.id}`,name:`نشاط مشترك`,specialty,area},
          share,team:share.teamId,specialty,area,classification:``,...common,
        }));
      }
      return activity.clients.flatMap(client=>client.shares.map(share=>({
        activity,client,share,team:share.teamId,area:client.area||``,
        specialty:client.specialty||``,
        classification:rosters.get(share.teamId)?.get(client.code)||``,...common,
      })));
    });
  },[data,view]);
  const reportOptions = useMemo(() =>
    Object.fromEntries(reportKeys.map(key => [
      key, selectedOptions(facetOptions(reportSourceRows,filters,reportKeys,key), filters[key]),
    ])), [reportSourceRows,filters]);
  const rows = matchingRows(reportSourceRows, filters, reportKeys);
  const teamLabels = new Map(data.teams.map(team=>[team.id,team.name]));
  const months = Object.fromEntries([
    ...Array.from({length:12},(_,i)=>[
      String(i+1).padStart(2,`0`),
      new Date(2027,i,1).toLocaleDateString(`ar-JO`,{month:`long`}),
    ]),
    [`unscheduled`,`غير مجدول`],
  ]);
  const labelOf = (key,value) => key===`team` ? teamLabels.get(value)||value
    : key===`month` ? months[value]||value : key===`status` ? statusText[value]||value
    : key===`specialty` && value===EMPTY_SPECIALTY ? `بدون تخصص` : value;
  const filterFields = [
    [`team`,`الفريق`],[`month`,`الشهر`],[`type`,`نوع النشاط`],
    [`status`,`الحالة`],[`area`,`المنطقة`],[`specialty`,`التخصص`],[`classification`,`التصنيف`],
  ];
  const groups = view === `specialties` ? groupBySpecialty(rows) : new Map();
  if (view !== `specialties`) rows.forEach((r) => {
    const key =
      view === `customers`
        ? r.client.code
        : view === `months`
          ? r.activity.date?.slice(0, 7) || `غير مجدول`
          : view === `types`
            ? r.activity.type
            : r.share.teamId;
    const name =
      view === `customers`
        ? r.client.name
        : view === `teams`
          ? r.share.teamName || data.teams.find((t) => t.id === key)?.name
          : key;
    const g = groups.get(key) || {
      key,
      name,
      client: view === `customers` ? r.client : null,
      planned: 0,
      actual: 0,
      count: new Set(),
    };
    g.planned += r.activity.status === `cancelled` ? 0 : r.share.amount;
    g.actual += r.share.actual || 0;
    g.count.add(r.activity.id);
    groups.set(key, g);
  });
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>التقارير والتحليلات</h2>
          <p>تعتمد الأرقام على حصص الفرق، والأنشطة متعددة التخصصات تُعرض دون توزيع مالي افتراضي على الأطباء</p>
        </div>
        <button className="primary" disabled={busy} onClick={exportExcel}>
          <FileXls size={21} />
          تصدير Excel شامل
        </button>
      </div>
      <div className="tabs">
        {[
          [`teams`, `حسب الفرق`],
          [`specialties`, `حسب التخصص`],
          [`customers`, `حسب العملاء`],
          [`months`, `حسب الشهر`],
          [`types`, `حسب نوع النشاط`],
        ].map(([k, v]) => (
          <button
            key={k}
            className={view === k ? `active` : ``}
            onClick={() => setView(k)}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="report-filters">
        {filterFields.map(([key, label]) => (
          <Field key={key} label={label}>
            <select
              disabled={key === `classification` && !filters.team}
              value={filters[key]}
              onChange={(e) => setFilters(f => ({
                ...f, [key]: e.target.value,
                ...(key===`team` ? {classification: ``} : {}),
              }))}
            >
              <option value="">{key === `classification` && !filters.team ? `اختر فريقا أولا` : `الكل`}</option>
              {reportOptions[key].map(value => (
                <option key={value} value={value}>{labelOf(key,value)}</option>
              ))}
            </select>
          </Field>
        ))}
      </div>
      <section className="surface">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  {
                    {
                      teams: `الفريق`,
                      specialties: `التخصص`,
                      customers: `العميل`,
                      months: `الشهر`,
                      types: `نوع النشاط`,
                    }[view]
                  }
                </th>
                <th>عدد الأنشطة</th>
                <th>{view===`customers`?`المخطط USD*`:`المخطط غير الملغي USD`}</th>
                <th>{view===`customers`?`الفعلي USD*`:`الفعلي المسجل USD`}</th>
              </tr>
            </thead>
            <tbody>
              {[...groups.values()].map((g) => (
                <tr key={g.key}>
                  <td>
                    <b>{view === `customers` ? (
                      <ClientName client={g.client} activityCounts={activityCounts} customerKinds={customerKinds} />
                    ) : g.name}</b>
                    {view === `customers` && (
                      <small className="row-sub code">{g.key}</small>
                    )}
                  </td>
                  <td>{g.count.size}</td>
                  <td className="numeric">{view===`customers`?`—`:money(g.planned)}</td>
                  <td className="numeric">{view===`customers`?`—`:money(g.actual)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>الإجمالي</td>
                <td>{new Set(rows.map((r) => r.activity.id)).size}</td>
                <td className="numeric">{view===`customers`?`—`:money([...groups.values()].reduce((s,g)=>s+g.planned,0))}</td>
                <td className="numeric">{view===`customers`?`—`:money([...groups.values()].reduce((s,g)=>s+g.actual,0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {!groups.size && <Empty text="لا توجد بيانات ضمن الفلاتر" />}
      </section>
      <p className="hint">
        التصدير الشامل يحتوي جميع البيانات بصرف النظر عن الفلاتر الحالية •
        التصنيف في التقارير حسب قائمة الفريق الحالية • تخصص العميل ومنطقته حسب
        بياناته عند آخر حفظ للنشاط
      </p>
      {view === `teams` && (
        <section className="surface">
          <h3>الميزانيات السنوية — دون فلاتر الأنشطة</h3>
          <TeamTable teams={data.teams} />
        </section>
      )}
    </>
  );
}
function Admin({ data, perform, notify, reload, showAudit, isDemo, activityCounts, customerKinds }) {
  const [tab, setTab] = useState(`teams`),
    [busy, setBusy] = useState(false),
    [team, setTeam] = useState({ id: ``, name: ``, budget: `` }),
    [types, setTypes] = useState(data.settings.types.join(`\n`)),
    [account, setAccount] = useState({
      username: ``,
      name: ``,
      password: ``,
      role: `team`,
      teamId: ``,
    }),
    [userEdit, setUserEdit] = useState(null),
    [importTeam, setImportTeam] = useState(``),
    [templateRows, setTemplateRows] = useState([]),
    [templateIssues, setTemplateIssues] = useState([]),
    [templateTeam, setTemplateTeam] = useState(``),
    [progress, setProgress] = useState(``),
    [ack, setAck] = useState(false),
    [uploadName, setUploadName] = useState(``);
  const admin = data.profile.role === `admin`;
  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };
  const selectedImportTeam = data.teams.find((t) => t.id === importTeam);
  const currentRoster = data.rosters.find((r) => r.teamId === importTeam)?.rows || [];
  const mapped = templateTeam === importTeam ? templateRows.map(({ rowNumber, ...fields }) => fields) : [];
  async function upload() {
    if (isDemo) {
      notify(`رفع البيانات متاح بعد تسجيل الدخول الفعلي فقط`);
      return;
    }
    if (!importTeam || templateTeam !== importTeam || !mapped.length || templateIssues.length || !ack)
      throw new Error(`اختر الفريق وارفع القالب الصحيح وعالج الأخطاء ثم أكد الاستبدال`);
    setProgress(`تجهيز الرفع…`);
    const { id } = await request(`startImport`, { teamId: importTeam });
    for (let i = 0; i < mapped.length; i += 150) {
      await request(`importChunk`, { id, rows: mapped.slice(i, i + 150) });
      setProgress(
        `تم رفع ${Math.min(i + 150, mapped.length)} من ${mapped.length}`,
      );
    }
    setProgress(`اعتماد القائمة…`);
    await request(`finishImport`, { id });
    await reload();
    setTemplateRows([]);
    setTemplateIssues([]);
    setTemplateTeam(``);
    setUploadName(``);
    setAck(false);
    setProgress(``);
    notify(
      `تم استبدال قائمة الفريق بنجاح مع الاحتفاظ بالأنشطة السابقة`,
      `success`,
    );
  }
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>إدارة النظام</h2>
          <p>
            {admin
              ? `الفرق والميزانيات والعملاء والمستخدمون`
              : `الميزانيات وأنواع الأنشطة`}
          </p>
        </div>
        <button onClick={showAudit}>
          <ClockCounterClockwise size={18} />
          سجل التغييرات
        </button>
      </div>
      <div className="tabs">
        {[
          [`teams`, `الفرق والميزانيات`],
          ...(admin
            ? [
                [`upload`, `رفع العملاء`],
                [`users`, `المستخدمون`],
                [`visibility`, `رؤية الفرق`],
              ]
            : []),
          [`types`, `أنواع الأنشطة`],
        ].map(([k, v]) => (
          <button
            className={tab === k ? `active` : ``}
            key={k}
            onClick={() => setTab(k)}
          >
            {v}
          </button>
        ))}
      </div>
      {tab === `visibility` && admin && (
        <section className="surface team-visibility-panel">
          <h3>صلاحيات عرض بيانات الفرق الأخرى</h3>
          <p>يمكنك ضبط رؤية كل فريق بشكل مستقل. عند إيقاف العرض، يقتصر دليل العملاء وقوائم الأنشطة على بيانات الفريق والأطباء المشتركين فيه، ويظل اختيار الطبيب المشترك وتوزيع ميزانية فريقه متاحاً.</p>
          <p className="team-visibility-caveat">ملاحظة أمنية: يمنع Firestore قراءة العملاء والأنشطة غير المشتركة عند الإخفاء، لكن البيانات المحاسبية المجمعة موجودة حالياً في مستند Finance مشترك. لذلك هذا ليس عزلاً مالياً كاملاً للفرق، ويحتاج إعادة تصميم تخزين الميزانيات قبل اعتبار كل بيانات الفرق سرية.</p>
          <div className="team-visibility-list">
            {data.teams.map(t=>{
              const enabled=data.teamVisibility?.find(v=>v.id===t.id)?.showOtherTeams!==false;
              return <label className="team-visibility-row" key={t.id}>
                <span><b>{t.name}</b><small>{enabled?"يمكنه مشاهدة القوائم والأنشطة من الفرق الأخرى":"تظهر له بيانات فريقه والأطباء المشتركين فقط"}</small></span>
                <span className="team-visibility-control">
                  <input type="checkbox" checked={enabled} disabled={busy||isDemo}
                    onChange={e=>run(async()=>{
                      await perform("saveTeamVisibility",{teamId:t.id,showOtherTeams:e.target.checked},"تم تحديث عرض الفرق");
                    })}/>
                  {enabled?"عرض الفرق الأخرى":"إخفاء الفرق الأخرى"}
                </span>
              </label>;
            })}
          </div>
        </section>
      )}
      {tab === `teams` && (
        <div className="admin-columns">
          <section className="surface">
            <h3>{team.id ? `تعديل الفريق والميزانية` : `إضافة فريق`}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await perform(
                    `saveTeam`,
                    {
                      id: team.id || null,
                      name: team.name,
                      budget: cents(team.budget),
                    },
                    `تم حفظ الفريق والميزانية`,
                  );
                  setTeam({ id: ``, name: ``, budget: `` });
                });
              }}
            >
              <Field label="اسم الفريق">
                <input
                  value={team.name}
                  onChange={(e) =>
                    setTeam((t) => ({ ...t, name: e.target.value }))
                  }
                  required
                />
              </Field>
              <Field label="الميزانية السنوية USD">
                <AmountInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={team.budget}
                  onChange={(e) =>
                    setTeam((t) => ({ ...t, budget: e.target.value }))
                  }
                  required
                />
              </Field>
              <button className="primary" disabled={busy}>
                <FloppyDisk size={18} />
                حفظ
              </button>
              {team.id && (
                <button
                  type="button"
                  onClick={() => setTeam({ id: ``, name: ``, budget: `` })}
                >
                  إلغاء التعديل
                </button>
              )}
            </form>
          </section>
          <section className="surface">
            <h3>الفرق المسجلة</h3>
            {data.teams.map((t) => (
              <div className="admin-team" key={t.id}>
                <div>
                  <b dir="auto">{t.name}</b>
                  <small>
                    الميزانية: ${money(t.budget)} • المتاح: $
                    {money(t.budget - t.used)}
                  </small>
                </div>
                <button
                  onClick={() =>
                    setTeam({ id: t.id, name: t.name, budget: t.budget / 100 })
                  }
                >
                  تعديل
                </button>
              </div>
            ))}
            {!data.teams.length && <Empty text="أضف أول فريق للبدء" />}
          </section>
        </div>
      )}
      {tab === `types` && (
        <section className="surface narrow">
          <h3>قائمة أنواع الأنشطة</h3>
          <p>نوع واحد في كل سطر، وتظهر القائمة لجميع الفرق</p>
          <textarea
            rows={10}
            value={types}
            onChange={(e) => setTypes(e.target.value)}
          />
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              run(() =>
                perform(
                  `saveTypes`,
                  {
                    types: [
                      ...new Set(
                        types
                          .split(`\n`)
                          .map((t) => t.trim())
                          .filter(Boolean),
                      ),
                    ],
                  },
                  `تم تحديث أنواع الأنشطة`,
                ),
              )
            }
          >
            حفظ الأنواع
          </button>
        </section>
      )}
      {tab === `users` && admin && (
        <div className="admin-columns">
          <section className="surface">
            <h3>إنشاء مستخدم</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  if (isDemo)
                    throw new Error(`إنشاء الحسابات متاح في النظام الفعلي فقط`);
                  await perform(`createUser`, account, `تم إنشاء الحساب`);
                  setAccount({
                    username: ``,
                    name: ``,
                    password: ``,
                    role: `team`,
                    teamId: ``,
                  });
                });
              }}
            >
              <Field label="الاسم الظاهر">
                <input
                  required
                  value={account.name}
                  onChange={(e) =>
                    setAccount((a) => ({ ...a, name: e.target.value }))
                  }
                />
              </Field>
              <Field
                label="اسم المستخدم"
                hint="أحرف إنجليزية وأرقام، 3–40 حرفا"
              >
                <input
                  required
                  pattern="[a-zA-Z0-9._\-]{3,40}"
                  dir="ltr"
                  autoComplete="off"
                  value={account.username}
                  onChange={(e) =>
                    setAccount((a) => ({ ...a, username: e.target.value }))
                  }
                />
              </Field>
              <Field label="كلمة المرور">
                <input
                  required
                  minLength={8}
                  type="password"
                  autoComplete="new-password"
                  value={account.password}
                  onChange={(e) =>
                    setAccount((a) => ({ ...a, password: e.target.value }))
                  }
                />
              </Field>
              <Field label="الصلاحية">
                <select
                  value={account.role}
                  onChange={(e) =>
                    setAccount((a) => ({ ...a, role: e.target.value }))
                  }
                >
                  <option value="team">حساب فريق</option>
                  <option value="manager">Marketing Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
              {account.role === `team` && (
                <Field label="الفريق">
                  <select
                    required
                    value={account.teamId}
                    onChange={(e) =>
                      setAccount((a) => ({ ...a, teamId: e.target.value }))
                    }
                  >
                    <option value="">اختر الفريق</option>
                    {data.teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <button className="primary" disabled={busy}>
                <Plus size={18} />
                إنشاء الحساب
              </button>
            </form>
          </section>
          <section className="surface">
            <h3>الحسابات</h3>
            {data.users.map((u) => (
              <div className="admin-team" key={u.id}>
                <div>
                  <b>{u.name}</b>
                  <small>
                    {u.username} • {roleText[u.role]} •{" "}
                    {u.active ? `مفعل` : `معطل`}
                  </small>
                </div>
                <button onClick={() => setUserEdit({ ...u, password: `` })}>
                  إدارة
                </button>
              </div>
            ))}
            {!data.users.length && <Empty text="لا توجد حسابات في المعاينة" />}
          </section>
        </div>
      )}
      {userEdit && (
        <div className="modal-backdrop">
          <section className="modal">
            <h3>إدارة حساب {userEdit.name}</h3>
            <Field label="كلمة مرور جديدة (اختياري)">
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={userEdit.password}
                onChange={(e) =>
                  setUserEdit((u) => ({ ...u, password: e.target.value }))
                }
              />
            </Field>
            <label className="check-line">
              <Checkbox
                type="checkbox"
                checked={userEdit.active}
                onChange={(e) =>
                  setUserEdit((u) => ({ ...u, active: e.target.checked }))
                }
              />
              حساب مفعل
            </label>
            <div className="button-row">
              <button onClick={() => setUserEdit(null)}>رجوع</button>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await perform(
                      `updateUser`,
                      {
                        id: userEdit.id,
                        active: userEdit.active,
                        password: userEdit.password,
                      },
                      `تم تحديث الحساب`,
                    );
                    setUserEdit(null);
                  })
                }
              >
                حفظ التغييرات
              </button>
            </div>
          </section>
        </div>
      )}
      {tab === `upload` && admin && (
        <section className="surface roster-upload">
          <div className="section-heading">
            <div>
              <h3>قوالب عملاء الفرق</h3>
              <p>كل فريق له قالب Excel مستقل • معاينة وتدقيق قبل استبدال القائمة</p>
            </div>
          </div>
          <div className="roster-steps">
            <div className="roster-step">
              <span className="roster-step-number">1</span>
              <div>
                <h4>اختر الفريق</h4>
                <p>حدد الفريق الذي ستقوم باستبدال قائمة عملائه</p>
                <Field label="الفريق المستهدف">
                  <select
                    disabled={busy}
                    value={importTeam}
                    onChange={(e) => {
                      setImportTeam(e.target.value);
                      setTemplateRows([]);
                      setTemplateIssues([]);
                      setTemplateTeam(``);
                      setUploadName(``);
                      setAck(false);
                    }}
                  >
                    <option value="">اختر الفريق</option>
                    {data.teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
            <div className="roster-step">
              <span className="roster-step-number">2</span>
              <div>
                <h4>نزّل قالب الفريق وعبئ العملاء</h4>
                <p>ستة أعمدة ثابتة؛ كود العميل واسمه إلزاميان، والكود منسق كنص</p>
                <div className="roster-actions">
                  <button
                    type="button"
                    disabled={!selectedImportTeam || busy}
                    onClick={() => run(() => downloadRosterTemplate(selectedImportTeam))}
                  >
                    <Download size={19} /> تنزيل قالب فارغ
                  </button>
                  <button
                    type="button"
                    disabled={!selectedImportTeam || !currentRoster.length || busy}
                    onClick={() => run(() => downloadRosterTemplate(selectedImportTeam, currentRoster))}
                  >
                    <FileXls size={19} /> تنزيل القائمة الحالية بالقالب ({currentRoster.length})
                  </button>
                </div>
              </div>
            </div>
            <div className="roster-step">
              <span className="roster-step-number">3</span>
              <div>
                <h4>ارفع القالب المعبأ</h4>
                <p>يتم قبول قالب XLSX الخاص بالفريق المختار فقط. لا يتم تغيير بيانات Firestore قبل التأكيد</p>
                <label className={`upload-zone roster-template-zone ${!importTeam || busy ? `is-disabled` : ``}`}>
                  <UploadSimple size={31} />
                  <b>{uploadName || `اختر ملف القالب المعبأ`}</b>
                  <span>صيغة XLSX فقط • تحقق من بيانات العملاء قبل الاعتماد</span>
                  <input
                    type="file"
                    accept=".xlsx"
                    disabled={!importTeam || busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) run(async () => {
                        setTemplateRows([]);
                        setTemplateIssues([]);
                        setUploadName(``);
                        setAck(false);
                        const result = await readRosterTemplate(file, importTeam);
                        setTemplateRows(result.rows);
                        setTemplateIssues(result.issues);
                        setTemplateTeam(importTeam);
                        setUploadName(file.name);
                        if (result.issues.length)
                          notify(`يوجد أخطاء في القالب. صحح الصفوف المحددة ثم أعد رفع الملف`);
                      });
                      e.target.value = ``;
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
          {templateTeam === importTeam && mapped.length > 0 && (
            <div className="roster-preview">
              <h3>معاينة العملاء — {uploadName}</h3>
              <div className="import-summary">
                <span>{mapped.length} عميل</span>
                <span className={templateIssues.length ? `warning-text` : ``}>
                  {templateIssues.length ? `توجد ${templateIssues.length} ملاحظات يجب تصحيحها` : `البيانات اجتازت التحقق`}
                </span>
              </div>
              {!!templateIssues.length && (
                <div className="roster-errors" role="alert">
                  <strong>أخطاء القالب:</strong>
                  <ul>
                    {templateIssues.slice(0, 12).map((issue, i) => <li key={i}>{issue}</li>)}
                  </ul>
                  {templateIssues.length > 12 && <small>و${templateIssues.length - 12} أخطاء أخرى</small>}
                </div>
              )}
              <div className="table-wrap">
                <table>
                  <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
                  <tbody>
                    {mapped.slice(0, 8).map((row, i) => (
                      <tr key={i}>
                        {columns.map((c) => (
                          <td key={c.key}>
                            {c.key === `name` ? (
                              <ClientName client={row} activityCounts={activityCounts} customerKinds={customerKinds} />
                            ) : row[c.key] || `—`}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="hint">معاينة أول 8 عملاء • الملف يستبدل قائمة هذا الفريق كاملة ويحافظ على سجل الأنشطة السابقة</p>
              <label className="check-line import-confirm">
                <Checkbox
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                أؤكد استبدال جميع عملاء الفريق بهذه القائمة، وإيقاف ربط العملاء المحذوفين للأنشطة الجديدة
              </label>
              <button
                className="primary"
                disabled={busy || !ack || !mapped.length || templateIssues.length > 0 || templateTeam !== importTeam}
                onClick={() => run(upload)}
              >
                <UploadSimple size={20} />
                {busy ? progress || `جار الرفع…` : `اعتماد ورفع ${mapped.length} عميل`}
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
