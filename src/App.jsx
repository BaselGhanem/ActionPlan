import React, { useEffect, useMemo, useState } from "react";
import {
  House,
  Users,
  CalendarBlank,
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
import { demoData } from "./demo";
import {
  equally,
  weighted,
  validateActivity,
  charges,
  cents,
} from "./data/domain";
import {
  columns,
  autoMap,
  readFile,
  delimited,
  downloadWorkbook,
} from "./files";
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
});
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
        e.code === `auth/invalid-credential`
          ? `اسم المستخدم أو كلمة المرور غير صحيحة`
          : e.code === `auth/unauthorized-domain`
            ? `يجب إضافة نطاق الموقع إلى Authorized domains في Firebase`
            : e.message,
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
    }),
    [pageNo, setPageNo] = useState(1);
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
  }, [filters]);
  const manager = data && [`admin`, `manager`].includes(data.profile.role);
  const allowed = routes.filter((r) => r.id !== `admin` || manager);
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
  const visible = useMemo(() => {
    if (!data) return [];
    return data.customers.filter((c) => {
      const r = rosterMap.get(filters.team)?.get(c.code),
        q = filters.search.trim().toLowerCase();
      return (
        (!q || `${c.name} ${c.code}`.toLowerCase().includes(q)) &&
        (!filters.team || r) &&
        (!filters.specialty || c.specialty === filters.specialty) &&
        (!filters.area || c.area === filters.area) &&
        (!filters.kind || c.kind === filters.kind) &&
        (!filters.classification ||
          r?.classification === filters.classification)
      );
    });
  }, [data, filters, rosterMap]);
  const options = (key) =>
    [
      ...new Set((data?.customers || []).map((c) => c[key]).filter(Boolean)),
    ].sort();
  function changeFilter(key, value) {
    setFilters((f) => ({
      ...f,
      [key]: value,
      ...(key === `team` ? { classification: `` } : {}),
    }));
  }
  const eligible = (c) =>
    data.teams.filter((t) => rosterMap.get(t.id)?.has(c.code));
  function selectClient(c) {
    const current = draft || defaultDraft();
    if (current.clients.some((x) => x.code === c.code)) {
      setDraft({
        ...current,
        clients: current.clients.filter((x) => x.code !== c.code),
      });
      return;
    }
    if (!manager && !rosterMap.get(data.profile.teamId)?.has(c.code)) {
      notify(`يمكنك استعراض العميل، لكن إنشاء النشاط متاح لعملاء فريقك فقط`);
      return;
    }
    if(current.clients.length>=8){notify(`النشاط الواحد يدعم حتى 8 عملاء`);return;}
    const myTeam = eligible(c).find((t) => t.id === data.profile.teamId),
      newClient = {
        ...c,
        amount: current.clients.length ? 0 : current.total,
        actual: null,
        shares: myTeam
          ? [
              {
                teamId: myTeam.id,
                teamName: myTeam.name,
                amount: current.total,
                actual: null,
              },
            ]
          : [],
      };
    setDraft({ ...current, clients: [...current.clients, newClient] });
  }
  function updateClient(code, update) {
    setDraft((d) => ({
      ...d,
      clients: d.clients.map((c) =>
        c.code === code ? { ...c, ...update } : c,
      ),
    }));
  }
  function setTotal(value) {
    try {
      const n = inputMoney(value) ?? 0;
      setDraft((d) => ({
        ...d,
        total: n,
        clients:
          d.clients.length === 1
            ? d.clients.map((c) => ({
                ...c,
                amount: n,
                shares: c.shares.map((s, i) => ({
                  ...s,
                  amount: equally(n, c.shares.length)[i],
                })),
              }))
            : d.clients,
      }));
    } catch (e) {
      notify(e.message);
    }
  }
  function distribute(code) {
    setDraft((d) => ({
      ...d,
      clients: d.clients.map((c) =>
        !code || c.code === code
          ? {
              ...c,
              shares: c.shares.map((s, i) => ({
                ...s,
                amount: equally(c.amount, c.shares.length)[i],
              })),
            }
          : c,
      ),
    }));
  }
  function toggleTeam(c, t) {
    const shares = c.shares.some((s) => s.teamId === t.id)
      ? c.shares.filter((s) => s.teamId !== t.id)
      : [
          ...c.shares,
          { teamId: t.id, teamName: t.name, amount: 0, actual: null },
        ];
    const amounts = equally(c.amount, shares.length);
    updateClient(c.code, {
      shares: shares.map((s, i) => ({ ...s, amount: amounts[i] })),
    });
  }
  function setActual(value) {
    try {
      const n = inputMoney(value);
      setDraft((d) => {
        const amounts =
          n === null
            ? d.clients.map(() => null)
            : weighted(
                n,
                d.clients.map((c) => c.amount),
              );
        return {
          ...d,
          actual: n,
          clients: d.clients.map((c, i) => {
            const a = amounts[i],
              shares =
                a === null
                  ? c.shares.map(() => null)
                  : weighted(
                      a,
                      c.shares.map((s) => s.amount),
                    );
            return {
              ...c,
              actual: a,
              shares: c.shares.map((s, j) => ({ ...s, actual: shares[j] })),
            };
          }),
        };
      });
    } catch (e) {
      notify(e.message);
    }
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
  async function saveActivity() {
    try {
      validateActivity(draft);
      const old = data.activities.find((a) => a.id === draft.id),
        before = charges(old),
        after = charges(draft);
      for (const t of data.teams)
        if (
          t.used - (before[t.id] || 0) + (after[t.id] || 0) > t.budget ||
          (draft.actual !== null &&
            t.used -
              (before[t.id] || 0) +
              (charges({ ...draft, status: `executed` })[t.id] || 0) >
              t.budget)
        )
          throw new Error(`ميزانية ${t.name} لا تكفي، يجب زيادتها أولا`);
      setBusy(true);
      await perform(`saveActivity`, draft, `تم حفظ النشاط وتحديث الميزانيات`);
      setDraft(null);
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  function openActivity(a) {
    setDraft(structuredClone(a));
  }
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
    canEdit = draft && (manager || !draft.id || draft.creator === (data.profile.accountId || user.uid));
  return (
    <div className={`app ${draft ? `has-drawer` : ``}`}>
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
                    <option value="">جميع الفرق</option>
                    {data.teams.map((t) => (
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
                    {options(`specialty`).map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="المنطقة">
                  <select
                    value={filters.area}
                    onChange={(e) => changeFilter(`area`, e.target.value)}
                  >
                    <option value="">جميع المناطق</option>
                    {options(`area`).map((v) => (
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
                    {[
                      ...new Set(
                        (
                          data.rosters.find((r) => r.teamId === filters.team)
                            ?.rows || []
                        )
                          .map((c) => c.classification)
                          .filter(Boolean),
                      ),
                    ]
                      .sort()
                      .map((v) => (
                        <option key={v}>{v}</option>
                      ))}
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
                  </div>
                  <button
                    className="text-button"
                    onClick={() => {
                      setFilters({
                        search: ``,
                        team: ``,
                        specialty: ``,
                        area: ``,
                        classification: ``,
                        kind: ``,
                      });
                    }}
                  >
                    مسح الفلاتر
                  </button>
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
                      </tr>
                    </thead>
                    <tbody>
                      {visible
                        .slice((pageNo - 1) * 12, pageNo * 12)
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
                                {c.name}
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
                      عرض {(pageNo - 1) * 12 + 1}–
                      {Math.min(pageNo * 12, visible.length)} من{" "}
                      {visible.length} نتيجة
                    </span>
                    <div>
                      <button
                        disabled={pageNo === 1}
                        onClick={() => setPageNo((p) => p - 1)}
                      >
                        السابق
                      </button>
                      <b>{pageNo}</b>
                      <button
                        disabled={pageNo * 12 >= visible.length}
                        onClick={() => setPageNo((p) => p + 1)}
                      >
                        التالي
                      </button>
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
            <Activities data={data} onOpen={openActivity} />
          )}
          {page === `reports` && (
            <Reports data={data} exportExcel={exportExcel} busy={busy} />
          )}
          {page === `admin` && manager && (
            <Admin
              data={data}
              perform={perform}
              notify={notify}
              reload={reload}
              showAudit={showAudit}
              isDemo={isDemo}
            />
          )}
        </main>
      </div>
      {draft && (
        <>
          <div className="drawer-backdrop" onClick={() => setDraft(null)} />
          <aside className="allocation-panel">
            <div className="drawer-title">
              <h2>{draft.id ? `تفاصيل النشاط` : `توزيع النشاط`}</h2>
              <button
                className="icon-button"
                onClick={() => setDraft(null)}
                aria-label="إغلاق النموذج"
              >
                <X size={23} />
              </button>
            </div>
            <div className="drawer-scroll">
              <fieldset disabled={!canEdit || busy}>
                <div className="selected-summary">
                  <span className="eyebrow">
                    {draft.clients.length === 1
                      ? `العميل المختار`
                      : `نشاط جماعي • ${draft.clients.length} عملاء`}
                  </span>
                  {draft.clients.length === 1 ? (
                    <>
                      <h3>{draft.clients[0].name}</h3>
                      <span className="code-chip">{draft.clients[0].code}</span>
                      <p>
                        <Stethoscope size={16} />
                        {draft.clients[0].specialty || `غير محدد`}
                      </p>
                      <p>
                        <MapPin size={16} />
                        {draft.clients[0].area || `غير محدد`}
                      </p>
                    </>
                  ) : (
                    <p>حصة مستقلة لكل عميل، ثم توزيعها على فرقه • حتى 8 عملاء و8 فرق</p>
                  )}
                </div>
                <button
                  className="text-button add-client-button"
                  onClick={() => {
                    setPickerSearch(``);
                    setPicker(true);
                  }}
                  type="button"
                >
                  <Plus size={17} />
                  إضافة عميل آخر للنشاط
                </button>
                <Field label="نوع النشاط">
                  <select
                    value={draft.type}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, type: e.target.value }))
                    }
                  >
                    <option value="">اختر نوع النشاط</option>
                    {[
                      ...new Set([
                        ...data.settings.types,
                        ...(draft.type ? [draft.type] : []),
                      ]),
                    ].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                <Field label="الميزانية المخططة الإجمالية (USD)">
                  <div className="money-input">
                    <span>$</span>
                    <AmountInput
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.total / 100 || ``}
                      onChange={(e) => setTotal(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </Field>
                <div className="two-fields">
                  <Field label="تاريخ النشاط (اختياري)">
                    <input
                      type="date"
                      min="2027-01-01"
                      max="2027-12-31"
                      value={draft.date}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, date: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="حالة النشاط">
                    <select
                      value={draft.status}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, status: e.target.value }))
                      }
                    >
                      <option value="planned">مخطط</option>
                      <option value="executed">منفذ</option>
                      {manager && draft.id && (
                        <option value="cancelled">ملغي</option>
                      )}
                    </select>
                  </Field>
                </div>
                <button
                  className="equal-button"
                  onClick={() => distribute()}
                  type="button"
                >
                  <SquaresFour size={20} />
                  توزيع حصص العملاء بالتساوي على فرقهم
                </button>
                {draft.clients.map((c) => (
                  <section className="client-allocation" key={c.code}>
                    <div className="client-heading">
                      <h3>
                        {draft.clients.length > 1
                          ? c.name
                          : `الفرق الزائرة المشاركة`}
                      </h3>
                      {draft.clients.length > 1 && (
                        <button
                          className="icon-button"
                          title="إزالة العميل"
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              clients: d.clients.filter(
                                (x) => x.code !== c.code,
                              ),
                            }))
                          }
                        >
                          <X size={17} />
                        </button>
                      )}
                    </div>
                    {draft.clients.length > 1 && (
                      <Field label="حصة العميل من المخطط (USD)">
                        <AmountInput
                          type="number"
                          min="0"
                          step="0.01"
                          value={c.amount / 100 || ``}
                          onChange={(e) => {
                            try {
                              const n = inputMoney(e.target.value) ?? 0;
                              updateClient(c.code, {
                                amount: n,
                                shares: c.shares.map((s, i) => ({
                                  ...s,
                                  amount: equally(n, c.shares.length)[i],
                                })),
                              });
                            } catch (e) {
                              notify(e.message);
                            }
                          }}
                        />
                      </Field>
                    )}
                    <div className="team-checks">
                      {[
                        ...new Map(
                          [
                            ...eligible(c),
                            ...c.shares
                              .map((s) =>
                                data.teams.find((t) => t.id === s.teamId),
                              )
                              .filter(Boolean),
                          ].map((t) => [t.id, t]),
                        ).values(),
                      ].map((t) => (
                        <label key={t.id} className="check-line">
                          <Checkbox
                            type="checkbox"
                            checked={c.shares.some((s) => s.teamId === t.id)}
                            onChange={() => toggleTeam(c, t)}
                          />
                          <span dir="auto">{t.name}</span>
                        </label>
                      ))}
                    </div>
                    {!eligible(c).length && !c.shares.length && (
                      <p className="warning-text">
                        لا يوجد فريق يزور هذا العميل حاليا
                      </p>
                    )}
                    {c.shares.map((s) => {
                      const t = data.teams.find((t) => t.id === s.teamId);
                      return (
                        <div className="share-row" key={s.teamId}>
                          <div>
                            <b dir="auto">{t?.name || s.teamName}</b>
                            <small>
                              المتاح:{" "}
                              <span dir="ltr">
                                ${money((t?.budget || 0) - (t?.used || 0))}
                              </span>
                            </small>
                          </div>
                          <div className="money-input">
                            <span>$</span>
                            <AmountInput
                              aria-label={`حصة ${t?.name} للعميل ${c.name}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={s.amount / 100}
                              onChange={(e) => {
                                try {
                                  const n = inputMoney(e.target.value) ?? 0;
                                  updateClient(c.code, {
                                    shares: c.shares.map((x) =>
                                      x.teamId === s.teamId
                                        ? { ...x, amount: n }
                                        : x,
                                    ),
                                  });
                                } catch (e) {
                                  notify(e.message);
                                }
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {draft.clients.length > 1 && (
                      <button
                        className="text-button"
                        onClick={() => distribute(c.code)}
                      >
                        توزيع حصة هذا العميل بالتساوي
                      </button>
                    )}
                    <div
                      className={`balance-note ${c.shares.reduce((n, s) => n + s.amount, 0) !== c.amount ? `invalid` : ``}`}
                    >
                      <CheckCircle size={17} />
                      فرق التوزيع:{" "}
                      <AnimatedMoney
                        value={
                          c.amount - c.shares.reduce((n, s) => n + s.amount, 0)
                        }
                      />
                    </div>
                  </section>
                ))}
                {draft.clients.length > 1 && (
                  <div
                    className={`balance-note ${draft.clients.reduce((n, c) => n + c.amount, 0) !== draft.total ? `invalid` : ``}`}
                  >
                    فرق حصص العملاء:{" "}
                    <span dir="ltr">
                      $
                      {money(
                        draft.total -
                          draft.clients.reduce((n, c) => n + c.amount, 0),
                      )}
                    </span>
                  </div>
                )}
                <details
                  className="actual-section"
                  open={draft.actual !== null || draft.status === `executed`}
                >
                  <summary>المصروف الفعلي والمتابعة</summary>
                  <p className="hint">
                    يبقى المخطط محجوزا حتى إغلاق النشاط؛ ثم يحل الفعلي محله
                  </p>
                  <Field label="المبلغ الفعلي الإجمالي (USD)">
                    <AmountInput
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.actual === null ? `` : draft.actual / 100}
                      onChange={(e) => setActual(e.target.value)}
                    />
                  </Field>
                  {draft.actual !== null &&
                    draft.clients.map((c) => (
                      <div className="actual-client" key={c.code}>
                        <b>{c.name}</b>
                        <Field label="حصة العميل الفعلية">
                          <AmountInput
                            type="number"
                            min="0"
                            step="0.01"
                            value={(c.actual || 0) / 100}
                            onChange={(e) => {
                              try {
                                const n = inputMoney(e.target.value) ?? 0;
                                const shares = weighted(
                                  n,
                                  c.shares.map((s) => s.amount),
                                );
                                updateClient(c.code, {
                                  actual: n,
                                  shares: c.shares.map((s, i) => ({
                                    ...s,
                                    actual: shares[i],
                                  })),
                                });
                              } catch (e) {
                                notify(e.message);
                              }
                            }}
                          />
                        </Field>
                        {c.shares.map((s) => (
                          <Field key={s.teamId} label={`فعلي ${s.teamName}`}>
                            <AmountInput
                              type="number"
                              min="0"
                              step="0.01"
                              value={(s.actual || 0) / 100}
                              onChange={(e) => {
                                try {
                                  const n = inputMoney(e.target.value) ?? 0;
                                  updateClient(c.code, {
                                    shares: c.shares.map((x) =>
                                      x.teamId === s.teamId
                                        ? { ...x, actual: n }
                                        : x,
                                    ),
                                  });
                                } catch (e) {
                                  notify(e.message);
                                }
                              }}
                            />
                          </Field>
                        ))}
                      </div>
                    ))}
                </details>
                <Field label="ملاحظات">
                  <textarea
                    rows={3}
                    maxLength={3000}
                    value={draft.notes}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, notes: e.target.value }))
                    }
                  />
                </Field>
              </fieldset>
            </div>
            <footer className="drawer-footer">
              {canEdit ? (
                <>
                  <button
                    className="primary"
                    onClick={saveActivity}
                    disabled={busy || !draft.clients.length}
                  >
                    <FloppyDisk size={20} />
                    {busy ? `جار الحفظ…` : `حفظ النشاط والتوزيع`}
                  </button>
                  {oldDraft &&
                    oldDraft.actual === null &&
                    oldDraft.status === `planned` && (
                      <button
                        className="danger-text"
                        onClick={() =>
                          setConfirm({
                            title: `حذف النشاط نهائيا؟`,
                            text: `ستعاد المبالغ المحجوزة للفرق، ويبقى أثر العملية في سجل التغييرات`,
                            action: async () => {
                              await perform(
                                `deleteActivity`,
                                { id: draft.id },
                                `تم حذف النشاط وإعادة الميزانية`,
                              );
                              setDraft(null);
                            },
                          })
                        }
                      >
                        <Trash size={16} />
                        حذف النشاط
                      </button>
                    )}
                </>
              ) : (
                <p className="hint">
                  للقراءة فقط — التعديل لمنشئ النشاط والإدارة
                </p>
              )}
            </footer>
          </aside>
        </>
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
                      <b>{c.name}</b>
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
            <div className="button-row">
              <button onClick={() => setConfirm(null)}>رجوع</button>
              <button
                className="primary"
                disabled={busy}
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
        <TeamTable teams={data.teams} />
      </section>
    </>
  );
}
function TeamTable({ teams }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>الفريق</th>
            <th>الميزانية USD</th>
            <th>المحجوز والمصروف USD</th>
            <th>المتاح USD</th>
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
function Activities({ data, onOpen }) {
  const [q, setQ] = useState(``),
    [status, setStatus] = useState(``);
  const rows = data.activities.filter(
    (a) =>
      (!status || a.status === status) &&
      (!q ||
        `${a.type} ${a.clients.map((c) => c.name).join(` `)} ${a.id}`.includes(
          q,
        )),
  );
  return (
    <>
      <div className="section-heading">
        <div>
          <h2>سجل الأنشطة</h2>
          <p>يمكن للجميع استعراض التفاصيل، والتعديل لمنشئ النشاط والإدارة</p>
        </div>
        <span className="count">{rows.length}</span>
      </div>
      <div className="inline-filters">
        <input
          placeholder="ابحث عن نشاط أو عميل"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">جميع الحالات</option>
          {Object.entries(statusText).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <section className="surface">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>النشاط</th>
                <th>العملاء</th>
                <th>التوقيت</th>
                <th>المخطط USD</th>
                <th>الفعلي USD</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((a) => (
                  <tr key={a.id}>
                    <td>
                      <b>{a.type}</b>
                      <small className="row-sub code">{a.id.slice(-8)}</small>
                    </td>
                    <td>{a.clients.map((c) => c.name).join(`، `)}</td>
                    <td>{a.date || `غير مجدول`}</td>
                    <td className="numeric">{money(a.total)}</td>
                    <td className="numeric">
                      {a.actual === null ? `—` : money(a.actual)}
                    </td>
                    <td>
                      <Badge status={a.status} />
                    </td>
                    <td>
                      <button className="text-button" onClick={() => onOpen(a)}>
                        عرض التفاصيل
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty text="لا توجد أنشطة مطابقة" />}
      </section>
    </>
  );
}
function Reports({ data, exportExcel, busy }) {
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
  const activities = data.activities.filter(
    (a) =>
      (!filters.month ||
        (filters.month === `unscheduled`
          ? !a.date
          : a.date?.slice(5, 7) === filters.month)) &&
      (!filters.type || a.type === filters.type) &&
      (!filters.status || a.status === filters.status),
  );
  const rows = activities.flatMap((a) =>
    a.clients.flatMap((c) =>
      c.shares
        .filter(
          (s) =>
            (!filters.team || s.teamId === filters.team) &&
            (!filters.area || c.area === filters.area) &&
            (!filters.specialty || c.specialty === filters.specialty) &&
            (!filters.classification ||
              data.rosters
                .find((r) => r.teamId === s.teamId)
                ?.rows.find((r) => r.code === c.code)?.classification ===
                filters.classification),
        )
        .map((s) => ({ activity: a, client: c, share: s })),
    ),
  );
  const groups = new Map();
  rows.forEach((r) => {
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
          <p>تفاصيل التوزيعات تمنع تكرار احتساب النشاط المشترك</p>
        </div>
        <button className="primary" disabled={busy} onClick={exportExcel}>
          <FileXls size={21} />
          تصدير Excel شامل
        </button>
      </div>
      <div className="tabs">
        {[
          [`teams`, `حسب الفرق`],
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
        {[
          [`team`, `الفريق`, data.teams.map((t) => [t.id, t.name])],
          [
            `month`,
            `الشهر`,
            [
              ...Array.from({ length: 12 }, (_, i) => [
                String(i + 1).padStart(2, `0`),
                new Date(2027, i, 1).toLocaleDateString(`ar-JO`, {
                  month: `long`,
                }),
              ]),
              [`unscheduled`, `غير مجدول`],
            ],
          ],
          [`type`, `نوع النشاط`, data.settings.types.map((t) => [t, t])],
          [`status`, `الحالة`, Object.entries(statusText)],
          [
            `area`,
            `المنطقة`,
            [...new Set(data.customers.map((c) => c.area).filter(Boolean))].map(
              (t) => [t, t],
            ),
          ],
          [
            `specialty`,
            `التخصص`,
            [
              ...new Set(
                data.customers.map((c) => c.specialty).filter(Boolean),
              ),
            ].map((t) => [t, t]),
          ],
          [
            `classification`,
            `التصنيف`,
            [
              ...new Set(
                (
                  data.rosters.find((r) => r.teamId === filters.team)?.rows ||
                  []
                )
                  .map((c) => c.classification)
                  .filter(Boolean),
              ),
            ].map((t) => [t, t]),
          ],
        ].map(([key, label, opts]) => (
          <Field key={key} label={label}>
            <select
              disabled={key === `classification` && !filters.team}
              value={filters[key]}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  [key]: e.target.value,
                  ...(key === `team` ? { classification: `` } : {}),
                }))
              }
            >
              <option value="">
                {key === `classification` && !filters.team
                  ? `اختر فريقا أولا`
                  : `الكل`}
              </option>
              {opts.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
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
                      customers: `العميل`,
                      months: `الشهر`,
                      types: `نوع النشاط`,
                    }[view]
                  }
                </th>
                <th>عدد الأنشطة</th>
                <th>المخطط غير الملغي USD</th>
                <th>الفعلي المسجل USD</th>
              </tr>
            </thead>
            <tbody>
              {[...groups.values()].map((g) => (
                <tr key={g.key}>
                  <td>
                    <b>{g.name}</b>
                    {view === `customers` && (
                      <small className="row-sub code">{g.key}</small>
                    )}
                  </td>
                  <td>{g.count.size}</td>
                  <td className="numeric">{money(g.planned)}</td>
                  <td className="numeric">{money(g.actual)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>الإجمالي</td>
                <td>{new Set(rows.map((r) => r.activity.id)).size}</td>
                <td className="numeric">
                  {money(
                    [...groups.values()].reduce((s, g) => s + g.planned, 0),
                  )}
                </td>
                <td className="numeric">
                  {money(
                    [...groups.values()].reduce((s, g) => s + g.actual, 0),
                  )}
                </td>
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
function Admin({ data, perform, notify, reload, showAudit, isDemo }) {
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
    [raw, setRaw] = useState([]),
    [mapping, setMapping] = useState({}),
    [paste, setPaste] = useState(``),
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
  const loadRows = (rows, name) => {
    if (rows.length < 2)
      throw new Error(`الملف يجب أن يحتوي عناوين وأسماء عملاء`);
    setRaw(rows);
    setMapping(autoMap(rows[0]));
    setUploadName(name);
    setAck(false);
  };
  const mapped = raw
    .slice(1)
    .filter((r) => r.some((v) => String(v ?? ``).trim()))
    .map((r) =>
      Object.fromEntries(
        columns.map((c) => [
          c.key,
          mapping[c.key] >= 0 ? String(r[mapping[c.key]] ?? ``).trim() : ``,
        ]),
      ),
    );
  const duplicate = mapped.length - new Set(mapped.map((r) => r.code)).size,
    invalid = mapped.filter((r) => !r.code || !r.name || r.code.includes(`/`));
  async function upload() {
    if (isDemo) {
      notify(`رفع البيانات متاح بعد تسجيل الدخول الفعلي فقط`);
      return;
    }
    if (!importTeam || !mapped.length || invalid.length || duplicate || !ack)
      throw new Error(`اختر الفريق وعالج الأخطاء وأكد استبدال القائمة`);
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
    setRaw([]);
    setPaste(``);
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
        <section className="surface">
          <div className="section-heading">
            <div>
              <h3>استبدال قائمة عملاء الفريق</h3>
              <p>
                تبقى الأنشطة السابقة محفوظة • بيانات العميل المشتركة تعتمد آخر
                رفع
              </p>
            </div>
          </div>
          <Field label="الفريق المستهدف">
            <select
              value={importTeam}
              onChange={(e) => {
                setImportTeam(e.target.value);
                setAck(false);
              }}
            >
              <option value="">اختر الفريق</option>
              {data.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="upload-grid">
            <label className="upload-zone">
              <UploadSimple size={34} />
              <b>اختيار ملف من الجهاز</b>
              <span>Excel XLSX أو CSV — العناوين في الصف الأول</span>
              <input
                type="file"
                accept=".xlsx,.csv"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files[0];
                  if (f) run(async () => loadRows(await readFile(f), f.name));
                  e.target.value = ``;
                }}
              />
            </label>
            <div>
              <Field label="أو الصق جدولا من Excel مع صف العناوين">
                <textarea
                  rows={4}
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  placeholder="الصق الجدول هنا"
                />
              </Field>
              <button
                disabled={!paste || busy}
                onClick={() =>
                  run(async () => loadRows(delimited(paste, `\t`), `جدول ملصق`))
                }
              >
                قراءة الجدول
              </button>
            </div>
          </div>
          {raw.length > 0 && (
            <>
              <h3>ربط الأعمدة — {uploadName}</h3>
              <div className="mapping-grid">
                {columns.map((c) => (
                  <Field
                    key={c.key}
                    label={`${c.label}${[`code`, `name`].includes(c.key) ? ` *` : ``}`}
                  >
                    <select
                      value={mapping[c.key] ?? -1}
                      onChange={(e) => {
                        setMapping((m) => ({
                          ...m,
                          [c.key]: Number(e.target.value),
                        }));
                        setAck(false);
                      }}
                    >
                      <option value={-1}>غير موجود</option>
                      {raw[0].map((v, i) => (
                        <option key={i} value={i}>
                          {v || `عمود ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
              <div className="import-summary">
                <span>{mapped.length} عميل</span>
                <span className={invalid.length ? `warning-text` : ``}>
                  {invalid.length} صف غير صالح
                </span>
                <span className={duplicate ? `warning-text` : ``}>
                  {duplicate} كود مكرر
                </span>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th key={c.key}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mapped.slice(0, 8).map((r, i) => (
                      <tr key={i}>
                        {columns.map((c) => (
                          <td key={c.key}>{r[c.key] || `—`}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="hint">
                معاينة أول 8 صفوف • الكود والاسم إلزاميان • احفظ أكواد العملاء
                كنص في Excel للحفاظ على الأصفار الأولى
              </p>
              <label className="check-line import-confirm">
                <Checkbox
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                />
                أؤكد استبدال قائمة هذا الفريق، وتعطيل ارتباط العملاء غير
                الموجودين فيها للأنشطة الجديدة
              </label>
              <button
                className="primary"
                disabled={
                  busy ||
                  !ack ||
                  !importTeam ||
                  invalid.length > 0 ||
                  duplicate > 0 ||
                  mapping.code < 0 ||
                  mapping.name < 0
                }
                onClick={() => run(upload)}
              >
                <UploadSimple size={20} />
                {busy
                  ? progress || `جار الرفع…`
                  : `اعتماد ورفع ${mapped.length} عميل`}
              </button>
            </>
          )}
        </section>
      )}
    </>
  );
}
