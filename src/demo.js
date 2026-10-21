export function demoData() {
  const teams = [
    {
      id: `cardio`,
      name: `Cardio`,
      budget: 2500000,
      used: 60000,
      roster: `r1`,
    },
    {
      id: `primary`,
      name: `Primary Care`,
      budget: 1800000,
      used: 60000,
      roster: `r2`,
    },
    {
      id: `specialty`,
      name: `Specialty`,
      budget: 1200000,
      used: 0,
      roster: `r3`,
    },
  ];
  const names = [
    `د. أحمد الحربي`,
    `د. نورة القحطاني`,
    `د. خالد العمري`,
    `مركز الحياة الطبي`,
    `د. ماجد المطيري`,
    `د. هيا العتيبي`,
    `مستشفى الأمل`,
    `د. ريم الزعبي`,
    `د. فيصل السالم`,
    `د. منال الشهري`,
    `د. عبد العزيز مراد`,
    `د. سارة الشمري`,
  ];
  const customers = names.map((name, i) => ({
    code: `D-${1042 + i}`,
    name,
    kind: i === 3 ? `مركز` : i === 6 ? `مستشفى` : `طبيب`,
    specialty: [`أمراض القلب`, `طب الأسرة`, `الباطنية`][i % 3],
    area: [`عمان`, `إربد`, `الزرقاء`][i % 3],
  }));
  const rosters = teams.map((t, i) => ({
    teamId: t.id,
    rows: customers
      .filter((c, k) => i < 2 || k % 2 === 0)
      .map((c, k) => ({ ...c, classification: [`A`, `B`, `C`][(k + i) % 3] })),
  }));
  const activities = [
    {
      id: `demo-activity`,
      creator: `demo`,
      year: 2027,
      type: `ندوة علمية`,
      status: `planned`,
      date: `2027-02-15`,
      total: 120000,
      actual: null,
      notes: `سجل توضيحي لتجربة النظام`,
      createdAt: Date.now(),
      clients: [
        {
          ...customers[0],
          amount: 120000,
          actual: null,
          shares: [
            {
              teamId: `cardio`,
              teamName: `Cardio`,
              amount: 60000,
              actual: null,
            },
            {
              teamId: `primary`,
              teamName: `Primary Care`,
              amount: 60000,
              actual: null,
            },
          ],
        },
      ],
    },
  ];
  return {
    profile: { name: `معاينة النظام`, role: `admin`, teamId: `cardio` },
    teams,
    customers,
    rosters,
    activities,
    settings: {
      types: [
        `ندوة علمية`,
        `مؤتمر طبي`,
        `اجتماع علمي`,
        `رعاية تعليمية`,
        `ورشة عمل`,
      ],
    },
    users: [],
  };
}
