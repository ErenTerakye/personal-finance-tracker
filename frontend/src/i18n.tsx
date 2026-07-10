import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";
import { setLocale as setFormatterLocale } from "./format";

export type Language = "en" | "tr";

const trDict = {
  common: {
    skipLink: "Ana içeriğe atla",
    toggleLanguage: "Dili değiştir",
    primaryNavigation: "Ana",
    databaseStorage: "Veritabanı depolama alanı",
    closeDialog: "İletişim kutusunu kapat",
    errorFallback: "İstek tamamlanamadı.",
    valid: "geçerli",
    duplicate: "yinelenen",
    invalid: "geçersiz",
    brandMarkSub: "Yerel Finans",
    localSqlite: "Yerel SQLite",
    loading: "Defter ayarları yükleniyor...",
    cancel: "İptal",
    edit: "Düzenle",
    delete: "Sil",
    save: "Kaydet",
    addEntry: "İşlem ekle",
    setBudget: "Bütçe belirle",
    importCsv: "CSV İçe Aktar",
    exportCsv: "CSV Dışa Aktar",
    resetFilters: "Filtreleri sıfırla",
    applyFilters: "Filtreleri uygula",
    category: "Kategori",
    type: "Tür",
    amount: "Tutar",
    date: "Tarih",
    description: "Açıklama",
    period: "Dönem",
    month: "Ay",
    year: "Yıl",
    status: "Durum",
    actions: "İşlemler",
    expense: "Gider",
    income: "Gelir",
    all: "Tümü",
    editTransaction: "{name} işlemini düzenle",
    deleteTransaction: "{name} işlemini sil",
    editBudget: "{name} bütçesini güncelle",
    deleteBudget: "{name} bütçesini sil",
  },
  nav: {
    dashboard: "Kontrol Paneli",
    transactions: "İşlemler",
    budgets: "Bütçeler",
    rules: "Kurallar",
  },
  navShort: {
    dashboard: "Özet",
    transactions: "İşlemler",
    budgets: "Bütçe",
    rules: "Kurallar",
  },
  theme: {
    system: "Sistem renk ayarını kullan",
    light: "Açık modu kullan",
    dark: "Koyu modu kullan",
  },
  dashboard: {
    eyebrow: "Nakit Akışı Özeti",
    title: "Kontrol Paneli",
    summary: "Nakit akışını, bütçe baskısını ve son hareketleri inceleyin.",
    changePeriod: "Kontrol paneli dönemini değiştir",
    downloadLabel: "Kontrol paneli belgelerini indir",
    reportMenu: "Raporlar ve dışa aktarımlar",
    monthReport: "Aylık Rapor",
    monthChart: "Aylık Grafik",
    trendReport: "Trend Raporu",
    trendChart: "Trend Grafiği",
    summaryAria: "{period} dönemi kontrol paneli toplamları",
    kpi: {
      netPosition: "Net durum",
      savingsRate: "Tasarruf oranı",
      budgetRisk: "Bütçe riski",
      income: "Gelir",
      expenses: "Giderler",
      momNet: "Aylık Net Değişim",
      ytdNet: "YTD Net Konum",
      trendNet: "Trend Net Durum",
      trendEntries: "Trend Giriş Sayısı",
    },
    detail: {
      entries: "{count} kayıt",
      income: "{amount} gelir",
      risk: "{over} aşılmış, {near} sınırda",
      momCompare: "Önceki aya göre",
      ytdIncome: "{amount} gelir",
      trendTotal: "Altı aylık toplam",
      actions: "Sonraki işlemler",
    },
    sections: {
      trendTitle: "Cashflow Trendi",
      contextTitle: "Trend Bağlamı",
      contextDetail: "Gelir, gider ve net tasarruf",
      pressureTitle: "Bütçe Baskısı",
      mixTitle: "Gider Dağılımı",
      mixDetail: "Kategoriye göre harcama",
      activityTitle: "Son Hareketler",
      activityDetail: "En son hareketler",
    },
    empty: {
      loadingTitle: "Kontrol paneli yükleniyor",
      fetching: "İşlem kayıtları getiriliyor",
      preparing: "Nakit akışı trendi hazırlanıyor.",
    },
  },
  transactions: {
    title: "İşlemler",
    summary: "İşlemleri hızlıca kaydedin ve geçmişi gözden geçirin.",
    historyTitle: "İşlem Geçmişi",
    filterTitle: "Filtreler",
    filterSummary: "{period} dönemi işlemleri gösteriliyor.",
    filterAria: "İşlemleri filtrele",
    filterPeriod: "İşlem filtre dönemi",
    historyDetail: {
      loading: "İşlemler yükleniyor",
      count: "{count} işlem gösteriliyor",
    },
    empty: {
      loading: "İşlem geçmişi yükleniyor.",
      noTransactions: "İşlem bulunamadı",
      noTransactionsMsg: "Filtreleri değiştirin veya yeni bir işlem ekleyin.",
    },
    dialog: {
      deleteTitle: "İşlemi sil",
      deleteDescription: "{category} {amount}",
      deleteConfirmText: "Bu işlem kaydı yerel geçmişinizden silecektir.",
      deleteBtn: "İşlemi sil",
      addTitle: "İşlem Ekle",
      editTitle: "İşlemi Düzenle",
      addDescription: "Tutar, kategori ve tarihi kaydedin.",
      amountHint: "Pozitif bir tutar girin, örn: 45.90.",
      categoryHint: "Kategori takma adları kural kategorisine göre kaydedilir.",
    },
  },
  budgets: {
    title: "Bütçeler",
    summary: "Harcama sınırlarını izleyin ve bütçe kayıtlarını yönetin.",
    filterTitle: "Filtreler",
    filterSummary: "{period} dönemi bütçeleri gösteriliyor.",
    filterAria: "Bütçeleri filtrele",
    filterPeriod: "Bütçe filtre dönemi",
    pressureTitle: "Bütçe Baskısı",
    pressureLoading: "Durum yükleniyor",
    recordsTitle: "Bütçe Kayıtları",
    recordsLoading: "Bütçeler yükleniyor",
    recordsCount: "{count} kayıt gösteriliyor",
    empty: {
      noBudgets: "Bu dönem için bütçe bulunamadı",
      noBudgetsMsg:
        "Baskıyı izlemeye başlamak için bir kategori bütçesi belirleyin.",
      noRecords: "Bütçe bulunamadı",
      noRecordsMsg:
        "Filtreleri değiştirin veya bu dönem için bir bütçe belirleyin.",
    },
    dialog: {
      deleteTitle: "Bütçeyi sil",
      deleteConfirmText:
        "Bu işlem bütçe kaydını yerel bütçelerinizden silecektir.",
      deleteBtn: "Bütçeyi sil",
      setTitle: "Bütçe Belirle",
      updateTitle: "Bütçeyi Güncelle",
      setDescription: "Bir ay için kategori limitini belirleyin.",
      categoryHint: "Kategori eşleşmesi büyük/küçük harfe duyarsızdır.",
      amountHint: "Pozitif bir tutar girin, örn: 500.00.",
    },
  },
  rules: {
    title: "Kurallar",
    summary:
      "Kategorileri normalleştirin ve öngörülebilir aylık girişleri uygulayın.",
    applyFor: "{period} için uygula",
    infoCard1Title: "Kategori Takma Adları",
    infoCard1Desc:
      'İçe aktarılan CSV kategori adlarını otomatik olarak temizleyin. Örneğin bankanız "uber" veya "netflix" olarak içe aktarıyorsa, grafiklerinizin tekdüze kalması için takma adlar bunları "Ulaşım" veya "Eğlence" ile eşler.',
    infoCard2Title: "Yinelenen Şablonlar",
    infoCard2Desc:
      'Tekrarlayan gider veya gelirleri (kira, spor salonu aidatı veya maaş gibi) önceden tanımlayın. Tüm aktif şablonları o ay için anında işlem olarak kaydetmek için sağ üstteki "[Ay] için uygula" düğmesine tıklayın.',
    aliasesTitle: "Kategori Takma Adları",
    aliasesLoading: "Kurallar yükleniyor",
    aliasesCount: "{count} kural",
    aliasField: "Takma ad",
    aliasHint: "Örnek: groceries",
    categoryHint: "Örnek: Gıda",
    saveRuleBtn: "Kuralı kaydet",
    presetsTitle: "Popüler takma adları hızlı ekle:",
    presetsToggle: "Hızlı Ekleme Şablonlarını Göster",
    playgroundTitle: "Kategori eşlemesini test et",
    playgroundPlaceholder: "Bir CSV kategorisi yazın (örn: uber, netflix)...",
    playgroundSuccess:
      '"{input}" girdisini "{category}" kategorisine eşler (takma ad: "{alias}")',
    playgroundNeutral:
      '"{input}" ile eşleşen aktif takma ad yok. Değiştirilmeden içe aktarılacaktır.',
    emptyRules: "Henüz kategori takma adı tanımlanmamış.",
    templatesTitle: "Yinelenen şablonlar",
    templatesLoading: "Şablonlar yükleniyor",
    templatesCount: "{count} şablon",
    saveTemplateBtn: "Şablonu kaydet",
    dayField: "Gün",
    presetsTemplatesTitle: "Standart şablonları hızlı ekle:",
    presetsTemplatesToggle: "Şablon presets göster",
    emptyTemplates: "Henüz yinelenen şablon tanımlanmamış.",
    settingsTitle: "Defter ayarları",
    settingsCurrency: "Defter para birimi",
    settingsHint:
      "Para birimini değiştirmek tüm ekranlardaki biçimlendirmeyi günceller.",
    settingsSaveBtn: "Ayarları kaydet",
    onDayText: "her ayın {day}. günü",
    alreadyAdded: "Zaten eklenmiş",
    addPreset: "{name} ekle",
  },
  csv: {
    importTitle: "İşlem CSV İçe Aktar",
    importDesc: "Satırları yerel deftere yazmadan önce önizleyin.",
    importBudgetTitle: "Bütçe CSV İçe Aktar",
    importBudgetDesc:
      "CSV satırlarından aylık kategori bütçelerini belirleyin veya güncelleyin.",
    fileLabel: "CSV dosyası",
    fileHint: "CLI CSV komutlarıyla aynı sütunları kullanın.",
    previewReady: "CSV önizleme hazır.",
    previewSummary:
      "{valid} geçerli, {duplicate} yinelenen, {invalid} geçersiz.",
    importDuplicates: "Yinelenen satırları da içe aktar",
    linePreview: "Satır {line}: {status}",
    importBtn: "CSV İçe Aktar",
    previewBtn: "CSV Önizle",
    importedSummary: "{imported} içe aktarıldı, {skipped} atlandı.",
  },
  periodControl: {
    choosePeriod: "Dönem seçin, mevcut dönem: {period}",
    prevMonth: "Önceki ay, {period}",
    nextMonth: "Sonraki ay, {period}",
    monthLabel: "Ay",
    yearLabel: "Yıl",
    applyBtn: "Uygula",
  },
  charts: {
    title: "Altı aylık nakit akışı trendi",
    desc: "Döneme göre gelir, gider ve net tasarruf.",
    ariaTitle: "Altı aylık gelir, gider ve net tasarruf trendi",
    ariaDesc:
      "Seçilen dönem boyunca gelir, gider ve net tasarrufları karşılaştıran çizgi grafik.",
    income: "Gelir",
    expenses: "Giderler",
    net: "Net",
    emptyTrendTitle: "Henüz trend verisi yok",
    emptyTrendMsg: "Nakit akışı trendi oluşturmak için işlemler ekleyin.",
    emptyLineTitle: "Trend verisi yok",
    emptyLineMsg: "İşlemler eklendikten sonra trend gösterilecektir.",
    tooltipSavingsRate: "{rate} tasarruf oranı",
    tooltipEntries: "{count} kayıt",
    dataTable: "Grafik verilerini tablo olarak göster",
    period: "Dönem",
  },
  notices: {
    "transaction.created": "İşlem yerel deftere eklendi.",
    "transaction.updated": "İşlem değişiklikleri kaydedildi.",
    "transaction.deleted": "İşlem yerel defterden kaldırıldı.",
    "budget.saved": "Bütçe seçilen ay için kaydedildi.",
    "budget.deleted": "Bütçe yerel defterden kaldırıldı.",
    "category_rule.saved": "Kategori kuralı kaydedildi.",
    "category_rule.deleted": "Kategori kuralı kaldırıldı.",
    "recurring_template.saved": "Yinelenen şablon kaydedildi.",
    "recurring_template.deleted": "Yinelenen şablon kaldırıldı.",
    "recurring_template.applied": "Yinelenen şablonlar uygulandı.",
    "settings.currency_updated": "Defter para birimi güncellendi.",
    "csv.transactions.imported": "İşlem CSV içe aktarımı tamamlandı.",
    "csv.budgets.imported": "Bütçe CSV içe aktarımı tamamlandı.",
  },
  notFound: {
    eyebrow: "Sayfa bulunamadı",
    title: "Burada bir şey yok",
    summary: "Bu adres Finans Takipçisi'ndeki bir görünüme karşılık gelmiyor.",
    action: "Kontrol paneline dön",
  },
  categories: {
    Transport: "Ulaşım",
    "Food & Drinks": "Yiyecek & İçecek",
    Entertainment: "Eğlence",
    Shopping: "Alışveriş",
    Rent: "Kira",
    Salary: "Maaş",
    "Health & Wellness": "Sağlık & Yaşam",
    Utilities: "Faturalar",
  },
  presets: {
    "Monthly Rent": "Aylık Kira",
    Paycheck: "Maaş Ödemesi",
    "Netflix Subscription": "Netflix Üyeliği",
    "Gym Membership": "Spor Salonu Üyeliği",
    "Electric Bill": "Elektrik Faturası",
  },
};

const enDict: typeof trDict = {
  common: {
    skipLink: "Skip to main content",
    toggleLanguage: "Switch language",
    primaryNavigation: "Primary",
    databaseStorage: "Database storage",
    closeDialog: "Close dialog",
    errorFallback: "The request could not be completed.",
    valid: "valid",
    duplicate: "duplicate",
    invalid: "invalid",
    brandMarkSub: "Local Finance",
    localSqlite: "Local SQLite",
    loading: "Loading ledger settings...",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    addEntry: "Add entry",
    setBudget: "Set budget",
    importCsv: "Import CSV",
    exportCsv: "Export CSV",
    resetFilters: "Reset filters",
    applyFilters: "Apply filters",
    category: "Category",
    type: "Type",
    amount: "Amount",
    date: "Date",
    description: "Description",
    period: "Period",
    month: "Month",
    year: "Year",
    status: "Status",
    actions: "Actions",
    expense: "Expense",
    income: "Income",
    all: "All",
    editTransaction: "Edit {name} transaction",
    deleteTransaction: "Delete {name} transaction",
    editBudget: "Update {name} budget",
    deleteBudget: "Delete {name} budget",
  },
  nav: {
    dashboard: "Dashboard",
    transactions: "Transactions",
    budgets: "Budgets",
    rules: "Rules",
  },
  navShort: {
    dashboard: "Overview",
    transactions: "Entries",
    budgets: "Budgets",
    rules: "Rules",
  },
  theme: {
    system: "Use system color setting",
    light: "Use light mode",
    dark: "Use dark mode",
  },
  dashboard: {
    eyebrow: "Cashflow Overview",
    title: "Dashboard",
    summary: "Review cashflow, budget pressure, and recent activity.",
    changePeriod: "Change dashboard period",
    downloadLabel: "Download dashboard artifacts",
    reportMenu: "Reports and exports",
    monthReport: "Month report",
    monthChart: "Month chart",
    trendReport: "Trend report",
    trendChart: "Trend chart",
    summaryAria: "Dashboard totals for {period}",
    kpi: {
      netPosition: "Net position",
      savingsRate: "Savings rate",
      budgetRisk: "Budget risk",
      income: "Income",
      expenses: "Expenses",
      momNet: "MoM net",
      ytdNet: "YTD net",
      trendNet: "Trend net",
      trendEntries: "Trend entries",
    },
    detail: {
      entries: "{count} entries",
      income: "{amount} income",
      risk: "{over} over, {near} near",
      momCompare: "Compared with prior month",
      ytdIncome: "{amount} income",
      trendTotal: "Six-month total",
      actions: "Next actions",
    },
    sections: {
      trendTitle: "Cashflow Trend",
      contextTitle: "Trend context",
      contextDetail: "Income, expenses, and net savings",
      pressureTitle: "Budget pressure",
      mixTitle: "Expense mix",
      mixDetail: "Spending by category",
      activityTitle: "Recent activity",
      activityDetail: "Latest activity",
    },
    empty: {
      loadingTitle: "Loading dashboard",
      fetching: "Fetching transaction records",
      preparing: "Preparing the cashflow trend.",
    },
  },
  transactions: {
    title: "Transactions",
    summary: "Log transactions quickly and review history.",
    historyTitle: "Transaction History",
    filterTitle: "Filters",
    filterSummary: "Showing transactions for {period}.",
    filterAria: "Filter transactions",
    filterPeriod: "Transaction filter period",
    historyDetail: {
      loading: "Loading transactions",
      count: "{count} transactions shown",
    },
    empty: {
      loading: "Loading transaction history.",
      noTransactions: "No transactions found",
      noTransactionsMsg: "Change the filters or add a new ledger entry.",
    },
    dialog: {
      deleteTitle: "Delete transaction",
      deleteDescription: "{category} {amount}",
      deleteConfirmText: "This removes the record from your local history.",
      deleteBtn: "Delete transaction",
      addTitle: "Add transaction",
      editTitle: "Edit transaction",
      addDescription: "Record the amount, category, and date.",
      amountHint: "Use a positive amount, such as 45.90.",
      categoryHint: "Aliases are saved as their rule category.",
    },
  },
  budgets: {
    title: "Budgets",
    summary: "Monitor spending limits and manage budget records.",
    filterTitle: "Filters",
    filterSummary: "Showing budgets for {period}.",
    filterAria: "Filter budgets",
    filterPeriod: "Budget filter period",
    pressureTitle: "Budget pressure",
    pressureLoading: "Loading status",
    recordsTitle: "Budget records",
    recordsLoading: "Loading budgets",
    recordsCount: "{count} records shown",
    empty: {
      noBudgets: "No budgets for this period",
      noBudgetsMsg: "Set a category budget to start tracking pressure.",
      noRecords: "No budgets found",
      noRecordsMsg: "Change the filters or set a budget for this period.",
    },
    dialog: {
      deleteTitle: "Delete budget",
      deleteConfirmText:
        "This removes the budget record from your local budgets.",
      deleteBtn: "Delete budget",
      setTitle: "Set budget",
      updateTitle: "Update budget",
      setDescription: "Set the category limit for a month.",
      categoryHint: "Category matching is case-insensitive.",
      amountHint: "Use a positive amount, such as 500.00.",
    },
  },
  rules: {
    title: "Rules",
    summary: "Normalize categories and apply predictable monthly entries.",
    applyFor: "Apply for {period}",
    infoCard1Title: "Category Aliases",
    infoCard1Desc:
      'Automatically clean up imported CSV category names. For example, if your bank imports "uber" or "netflix", aliases will map them to "Transport" or "Entertainment" to keep your charts uniform.',
    infoCard2Title: "Recurring Templates",
    infoCard2Desc:
      'Pre-define repeat expenses or income (like rent, gym dues, or salary). Click "Apply for [Month]" at the top right to post all active templates as transactions for that month instantly.',
    aliasesTitle: "Category aliases",
    aliasesLoading: "Loading rules",
    aliasesCount: "{count} rules",
    aliasField: "Alias",
    aliasHint: "Example: groceries",
    categoryHint: "Example: Food",
    saveRuleBtn: "Save rule",
    presetsTitle: "Quick-add popular aliases:",
    presetsToggle: "Show Quick-Add Presets",
    playgroundTitle: "Test category mapping",
    playgroundPlaceholder: "Type a CSV category (e.g. uber, netflix)...",
    playgroundSuccess:
      'Maps "{input}" to canonical category "{category}" (via alias "{alias}")',
    playgroundNeutral:
      'No active alias matches "{input}". It will import unchanged.',
    emptyRules: "No category aliases yet.",
    templatesTitle: "Recurring templates",
    templatesLoading: "Loading templates",
    templatesCount: "{count} templates",
    saveTemplateBtn: "Save template",
    dayField: "Day",
    presetsTemplatesTitle: "Quick-add standard templates:",
    presetsTemplatesToggle: "Show Quick-Add Presets",
    emptyTemplates: "No recurring templates yet.",
    settingsTitle: "Ledger settings",
    settingsCurrency: "Ledger currency",
    settingsHint: "Changing currency updates formatting across all screens.",
    settingsSaveBtn: "Save settings",
    onDayText: "on day {day}",
    alreadyAdded: "Already added",
    addPreset: "Add {name}",
  },
  csv: {
    importTitle: "Import transaction CSV",
    importDesc: "Preview rows before writing to the local ledger.",
    importBudgetTitle: "Import budget CSV",
    importBudgetDesc: "Set or update monthly category budgets from CSV rows.",
    fileLabel: "CSV file",
    fileHint: "Use the same columns as the CLI CSV commands.",
    previewReady: "CSV preview ready.",
    previewSummary: "{valid} valid, {duplicate} duplicate, {invalid} invalid.",
    importDuplicates: "Import duplicate rows too",
    linePreview: "Line {line}: {status}",
    importBtn: "Import CSV",
    previewBtn: "Preview CSV",
    importedSummary: "Imported {imported}, skipped {skipped}.",
  },
  periodControl: {
    choosePeriod: "Choose period, current period is {period}",
    prevMonth: "Previous month, {period}",
    nextMonth: "Next month, {period}",
    monthLabel: "Month",
    yearLabel: "Year",
    applyBtn: "Apply",
  },
  charts: {
    title: "Six-month cashflow trend",
    desc: "Income, expenses, and net savings by period.",
    ariaTitle: "Six-month income, expense, and net savings trend",
    ariaDesc:
      "Line chart comparing income, expenses, and net savings across the selected period.",
    income: "Income",
    expenses: "Expenses",
    net: "Net",
    emptyTrendTitle: "No trend yet",
    emptyTrendMsg: "Add transactions to build a cashflow trend.",
    emptyLineTitle: "No trend data",
    emptyLineMsg: "The trend appears after transactions are added.",
    tooltipSavingsRate: "{rate} savings rate",
    tooltipEntries: "{count} entries",
    dataTable: "Show chart data as a table",
    period: "Period",
  },
  notices: {
    "transaction.created": "Transaction added to the local ledger.",
    "transaction.updated": "Transaction changes saved.",
    "transaction.deleted": "Transaction removed from the local ledger.",
    "budget.saved": "Budget saved for the selected month.",
    "budget.deleted": "Budget removed from the local ledger.",
    "category_rule.saved": "Category rule saved.",
    "category_rule.deleted": "Category rule removed.",
    "recurring_template.saved": "Recurring template saved.",
    "recurring_template.deleted": "Recurring template removed.",
    "recurring_template.applied": "Recurring templates applied.",
    "settings.currency_updated": "Ledger currency updated.",
    "csv.transactions.imported": "Transaction CSV import finished.",
    "csv.budgets.imported": "Budget CSV import finished.",
  },
  notFound: {
    eyebrow: "Page not found",
    title: "Nothing lives here",
    summary: "This address does not match a view in Finance Tracker.",
    action: "Return to dashboard",
  },
  categories: {
    Transport: "Transport",
    "Food & Drinks": "Food & Drinks",
    Entertainment: "Entertainment",
    Shopping: "Shopping",
    Rent: "Rent",
    Salary: "Salary",
    "Health & Wellness": "Health & Wellness",
    Utilities: "Utilities",
  },
  presets: {
    "Monthly Rent": "Monthly Rent",
    Paycheck: "Paycheck",
    "Netflix Subscription": "Netflix Subscription",
    "Gym Membership": "Gym Membership",
    "Electric Bill": "Electric Bill",
  },
};

const i18nContext = createContext<{
  locale: Language;
  setLocale: (locale: Language) => void;
  toggleLocale: () => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
  tUpper: (key: string, variables?: Record<string, string | number>) => string;
} | null>(null);

const STORAGE_KEY = "finance-tracker-language";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Language>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "tr" || stored === "en") {
        return stored;
      }
    } catch {}
    if (typeof navigator !== "undefined") {
      const lang = navigator.language || (navigator as any).userLanguage || "";
      if (lang.toLowerCase().startsWith("tr")) {
        return "tr";
      }
    }
    return "en";
  });

  const setLocale = (nextLocale: Language) => {
    setLocaleState(nextLocale);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {}
  };

  const toggleLocale = () => {
    setLocale(locale === "en" ? "tr" : "en");
  };

  // Synchronously sync the formatter locale on every render to avoid lag/race condition
  setFormatterLocale(locale);

  const t = (
    key: string,
    variables?: Record<string, string | number>,
  ): string => {
    const parts = key.split(".");
    let enVal: any = enDict;
    let trVal: any = trDict;

    for (const part of parts) {
      if (enVal) enVal = enVal[part];
      if (trVal) trVal = trVal[part];
    }

    let result = locale === "tr" ? trVal : enVal;
    if (result === undefined || result === null) {
      result = enVal;
    }
    if (result === undefined || result === null) {
      return key;
    }

    if (typeof result !== "string") {
      return key;
    }

    if (variables) {
      let interpolated = result;
      for (const [varName, varVal] of Object.entries(variables)) {
        interpolated = interpolated.replace(
          new RegExp(`{${varName}}`, "g"),
          String(varVal),
        );
      }
      return interpolated;
    }

    return result;
  };

  const tUpper = (
    key: string,
    variables?: Record<string, string | number>,
  ): string => {
    const parts = key.split(".");
    let enVal: any = enDict;
    let trVal: any = trDict;

    for (const part of parts) {
      if (enVal) enVal = enVal[part];
      if (trVal) trVal = trVal[part];
    }

    let result = locale === "tr" ? trVal : enVal;
    let resolvedLang: Language = locale;
    if (result === undefined || result === null) {
      result = enVal;
      resolvedLang = "en";
    }
    if (result === undefined || result === null) {
      return key.toUpperCase();
    }

    if (typeof result !== "string") {
      return key.toUpperCase();
    }

    let interpolated = result;
    if (variables) {
      for (const [varName, varVal] of Object.entries(variables)) {
        interpolated = interpolated.replace(
          new RegExp(`{${varName}}`, "g"),
          String(varVal),
        );
      }
    }

    return resolvedLang === "tr"
      ? interpolated.toLocaleUpperCase("tr-TR")
      : interpolated.toUpperCase();
  };

  return (
    <i18nContext.Provider value={{ locale, setLocale, toggleLocale, t, tUpper }}>
      {children}
    </i18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(i18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}

export function localizedNotice(
  response: { notice: string; notice_code?: string },
  t: (key: string) => string,
): string {
  if (!response.notice_code) {
    return response.notice;
  }
  const key = `notices.${response.notice_code}`;
  const translated = t(key);
  return translated === key ? response.notice : translated;
}
