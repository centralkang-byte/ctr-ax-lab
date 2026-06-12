import type { TrackId } from "./evaluator-meta";

// A pool of ready-to-evaluate example ideas. These power the suggestion cards
// shown above the input so a user can start from a concrete idea instead of a
// blank box. Each example has a short `label` (what shows on the card) and the
// full `text` (what gets pasted into the textarea).
//
// `category` is used to vary each batch of cards — see lib/shuffle.ts — so a
// refresh tends to surface a spread of idea types rather than three of a kind.

export type ExampleCategory =
  | "production" // 생산·품질
  | "scm" // 구매·SCM
  | "sales" // 영업·견적
  | "finance" // 재무·회계
  | "rnd" // 연구개발
  | "itdata" // IT·데이터
  | "strategy" // 경영기획·전략
  | "people"; // 인사·총무·법무

export interface Example {
  id: string;
  track: TrackId;
  category: ExampleCategory;
  kr: { label: string; text: string };
  en: { label: string; text: string };
}

export const CATEGORY_META: Record<ExampleCategory, { kr: string; en: string }> = {
  production: { kr: "생산·품질", en: "Production & Quality" },
  scm: { kr: "구매·SCM", en: "Purchasing & SCM" },
  sales: { kr: "영업·견적", en: "Sales & Quoting" },
  finance: { kr: "재무·회계", en: "Finance & Accounting" },
  rnd: { kr: "연구개발", en: "R&D" },
  itdata: { kr: "IT·데이터", en: "IT & Data" },
  strategy: { kr: "경영기획·전략", en: "Planning & Strategy" },
  people: { kr: "인사·총무·법무", en: "HR · Admin · Legal" },
};

export const EXAMPLES_POOL: Example[] = [
  // ── 생산·품질 (Production & Quality) — cards 1–9 ─────────────────────────
  {
    id: "ctr-auto-strength-test-report",
    track: "ai-vibe",
    category: "production",
    kr: {
      label: "강도시험보고서 자동 생성",
      text: "시험 데이터에서 강도시험보고서 초안을 자동 작성해 연구원이 검토만 하게 한다",
    },
    en: {
      label: "Auto strength-test report",
      text: "Drafts strength-test reports from raw test data so the engineer only reviews.",
    },
  },
  {
    id: "ctr-dimension-report-in-seconds",
    track: "ai-vibe",
    category: "production",
    kr: {
      label: "치수성적서 1초 생성",
      text: "DXF 도면에서 치수·공차를 직접 추출해 치수성적서를 자동 작성한다",
    },
    en: {
      label: "Dimension report in seconds",
      text: "Pulls dimensions/tolerances straight from DXF drawings to auto-build the inspection sheet.",
    },
  },
  {
    id: "ctr-cbiq-audit-report-automation",
    track: "ai-vibe",
    category: "production",
    kr: {
      label: "CBIQ 심사보고서 자동화",
      text: "심사 결과를 보고서·시정조치 요청서·종결회의 자료로 한 번에 변환한다",
    },
    en: {
      label: "CBIQ audit report automation",
      text: "Turns audit results into report, CAR, and closing-meeting docs in one pass.",
    },
  },
  {
    id: "ctr-iatf-csr-change-watcher",
    track: "ai-vibe",
    category: "production",
    kr: {
      label: "IATF 신규 CSR 모니터링",
      text: "고객 포털의 신규 CSR을 감지해 품질팀에 자동 메일로 통보한다",
    },
    en: {
      label: "IATF CSR change watcher",
      text: "Detects new customer-specific requirements and auto-emails the quality team.",
    },
  },
  {
    id: "ctr-standards-consistency-first-check",
    track: "ai-vibe",
    category: "production",
    kr: {
      label: "표준류 일치성 1차 점검",
      text: "신규 도면 1건의 CP·FMEA·작업표준서 기호 불일치를 자동 1차 검토한다",
    },
    en: {
      label: "Standards-consistency first check",
      text: "Auto first-pass check of one new drawing's CP/FMEA/work-standard mismatches.",
    },
  },
  {
    id: "ctr-field-claim-trend-alert",
    track: "ai-vibe",
    category: "production",
    kr: {
      label: "필드클레임 트렌드 알림",
      text: "필드클레임을 취합·트렌드 분석하고 임계치 초과 시 담당 부서에 알린다",
    },
    en: {
      label: "Field-claim trend alert",
      text: "Aggregates field claims, spots trends, and alerts the owning team on threshold breach.",
    },
  },
  {
    id: "ctr-4-plant-daily-kpi-roll-up",
    track: "ai-vibe",
    category: "production",
    kr: {
      label: "4개 공장 일일 실적 통합",
      text: "4개 공장의 생산성·품질 일일 실적을 단일 양식으로 자동 취합한다",
    },
    en: {
      label: "4-plant daily KPI roll-up",
      text: "Auto-consolidates productivity/quality daily results from four plants into one format.",
    },
  },
  {
    id: "ctr-assembly-line-inspection-alert",
    track: "ai-vibe",
    category: "production",
    kr: {
      label: "조립라인 검사 이상 알림",
      text: "MES의 조립라인 일일 검사결과에서 이상치를 찾아 자동 통보한다",
    },
    en: {
      label: "Assembly-line inspection alert",
      text: "Flags anomalies in MES daily line-inspection data and notifies automatically.",
    },
  },
  {
    id: "ctr-ppap-package-assembler",
    track: "ai-vibe",
    category: "production",
    kr: {
      label: "PPAP 서류 자동 취합",
      text: "PPAP 제출 패키지의 누락 항목을 점검하고 표준 양식으로 묶는다",
    },
    en: {
      label: "PPAP package assembler",
      text: "Checks PPAP submissions for missing items and bundles them into the standard format.",
    },
  },

  // ── 구매·SCM (Purchasing & SCM) — cards 10–20 ────────────────────────────
  {
    id: "ctr-al-base-price-daily-tracker",
    track: "ai-vibe",
    category: "scm",
    kr: {
      label: "AL 기준가격 상시 추적",
      text: "LME·환율·MJP를 매일 자동 수집해 알루미늄 기준가격을 산출한다",
    },
    en: {
      label: "AL base-price daily tracker",
      text: "Auto-pulls LME/FX/MJP daily to compute the aluminum base price.",
    },
  },
  {
    id: "ctr-overseas-quote-sor-standardizer",
    track: "ai-vibe",
    category: "scm",
    kr: {
      label: "해외 견적검토 SOR 표준화",
      text: "부품유형별 SOR 인자를 한·영 표준문서로 통합해 견적검토를 자동화한다",
    },
    en: {
      label: "Overseas-quote SOR standardizer",
      text: "Unifies SOR factors per part type into KR/EN standard docs to automate quote review.",
    },
  },
  {
    id: "ctr-6-system-purchasing-view",
    track: "ai-vibe",
    category: "scm",
    kr: {
      label: "구매 6개 시스템 통합 뷰",
      text: "ERP·SAP·e-Accounting·PSRM·QMS를 단일 화면으로 취합한다",
    },
    en: {
      label: "6-system purchasing view",
      text: "Consolidates ERP/SAP/e-Accounting/PSRM/QMS into one unified view.",
    },
  },
  {
    id: "ctr-supplier-risk-signal-monitor",
    track: "ai-vibe",
    category: "scm",
    kr: {
      label: "협력업체 RISK 신호 수집",
      text: "협력사 인건비·부채·매입금을 모니터링해 이상징후를 조기 감지한다",
    },
    en: {
      label: "Supplier-risk signal monitor",
      text: "Watches supplier labor cost/debt/payables to catch distress signals early.",
    },
  },
  {
    id: "ctr-overseas-warehouse-stock-reconciliation",
    track: "ai-vibe",
    category: "scm",
    kr: {
      label: "해외창고 재고정합성 검증",
      text: "24개 창고 수불 데이터를 SAP와 매칭해 정합성·오류를 자동 점검한다",
    },
    en: {
      label: "Overseas-warehouse stock reconciliation",
      text: "Matches 24-warehouse stock movements against SAP to auto-check consistency.",
    },
  },
  {
    id: "ctr-daily-safety-stock-alert",
    track: "ai-vibe",
    category: "scm",
    kr: {
      label: "카테고리 일일 재고 알림",
      text: "카테고리별 일일 재고와 안전재고를 비교해 부족분을 알린다",
    },
    en: {
      label: "Daily safety-stock alert",
      text: "Compares daily stock vs safety stock per category and flags shortfalls.",
    },
  },
  {
    id: "ctr-multi-rfq-comparison-table",
    track: "ai-vibe",
    category: "scm",
    kr: {
      label: "복수 RFQ 비교표 자동생성",
      text: "여러 공급사 RFQ를 단가·납기·조건으로 자동 비교표화한다",
    },
    en: {
      label: "Multi-RFQ comparison table",
      text: "Auto-builds a price/lead-time/terms comparison across supplier RFQs.",
    },
  },
  {
    id: "ctr-raw-material-weekly-market-brief",
    track: "ai-vibe",
    category: "scm",
    kr: {
      label: "원자재 시황 주간 브리핑",
      text: "웹·지수 데이터로 원자재 시황을 주간 자동 리포트한다",
    },
    en: {
      label: "Raw-material weekly market brief",
      text: "Auto-reports raw-material market conditions weekly from web/index data.",
    },
  },
  {
    id: "ctr-s-op-demand-forecast-assistant",
    track: "ai-vibe",
    category: "scm",
    kr: {
      label: "S&OP 수요예측 보조",
      text: "12개 예측기법과 ABC 분류로 월간 수요예측 초안을 만든다",
    },
    en: {
      label: "S&OP demand-forecast assistant",
      text: "Drafts monthly demand forecasts using 12 methods and ABC classification.",
    },
  },
  {
    id: "ctr-order-quantity-recommendation",
    track: "ai-vibe",
    category: "scm",
    kr: {
      label: "발주 추천 리포트",
      text: "리드타임·재고·예측을 결합해 발주량 추천 리포트를 생성한다",
    },
    en: {
      label: "Order-quantity recommendation",
      text: "Combines lead time, stock, and forecast into an order-quantity recommendation.",
    },
  },
  {
    id: "ctr-forwarder-bid-evaluator",
    track: "ai-vibe",
    category: "scm",
    kr: {
      label: "포워더 비딩 평가 자동화",
      text: "운송중 재고 ETA와 운임 견적을 비교해 포워더 비딩을 평가한다",
    },
    en: {
      label: "Forwarder-bid evaluator",
      text: "Compares in-transit ETA and freight quotes to score forwarder bids.",
    },
  },

  // ── 영업·견적 (Sales & Quoting) — cards 21–29 ────────────────────────────
  {
    id: "ctr-assembly-cost-estimate-engine",
    track: "ai-vibe",
    category: "sales",
    kr: {
      label: "조립 견적원가 자동 산출",
      text: "RFQ·BOM·투자검토서로 재료비~견적원가를 자동 계산한다",
    },
    en: {
      label: "Assembly cost-estimate engine",
      text: "Computes material-to-quote cost from RFQ/BOM/investment sheets automatically.",
    },
  },
  {
    id: "ctr-rfq-spec-fit-checker",
    track: "ai-vibe",
    category: "sales",
    kr: {
      label: "RFQ 사양 적합성 검토",
      text: "고객 RFQ를 과거 개선이력과 대조해 견적 사양 적합성을 확인한다",
    },
    en: {
      label: "RFQ spec-fit checker",
      text: "Cross-checks customer RFQs against past lessons to verify quote-spec fit.",
    },
  },
  {
    id: "ctr-po-auto-converter",
    track: "ai-vibe",
    category: "sales",
    kr: {
      label: "PO 자동 변환 앱",
      text: "PDF 발주서를 Excel·ERP 입력 양식으로 30분→1분 자동 변환한다",
    },
    en: {
      label: "PO auto-converter",
      text: "Turns PDF purchase orders into Excel/ERP entry format, 30 min → 1 min.",
    },
  },
  {
    id: "ctr-mid-term-sales-plan-automation",
    track: "ai-vibe",
    category: "sales",
    kr: {
      label: "중장기 매출계획 자동화",
      text: "전년·금년 실적을 비교해 중장기 매출·수주 계획 초안을 만든다",
    },
    en: {
      label: "Mid-term sales-plan automation",
      text: "Builds mid-term sales/order plan drafts from prior vs current-year results.",
    },
  },
  {
    id: "ctr-always-on-market-research",
    track: "ai-vibe",
    category: "sales",
    kr: {
      label: "상시 시장조사 뉴스레터",
      text: "매월 1일 자동 실행되는 시장조사 보고서와 뉴스레터를 발행한다",
    },
    en: {
      label: "Always-on market research",
      text: "Auto-runs monthly market research into a report and newsletter.",
    },
  },
  {
    id: "ctr-robotics-quote-generator",
    track: "ai-vibe",
    category: "sales",
    kr: {
      label: "로보틱스 견적원가 자동화",
      text: "발주요청 기반으로 4시트 견적서를 이력 DB 통계범위 내에서 생성한다",
    },
    en: {
      label: "Robotics quote generator",
      text: "Builds a 4-sheet quote from order requests within historical-DB ranges.",
    },
  },
  {
    id: "ctr-quote-to-dev-knowledge-link",
    track: "ai-vibe",
    category: "sales",
    kr: {
      label: "견적↔개발 이력 연결",
      text: "견적과 개발 시행착오를 하나의 데이터 흐름으로 연결·축적한다",
    },
    en: {
      label: "Quote-to-dev knowledge link",
      text: "Links quoting and development trial-and-error into one accumulating data flow.",
    },
  },
  {
    id: "ctr-customer-p-l-impact-analysis",
    track: "ai-vibe",
    category: "sales",
    kr: {
      label: "고객사 손익 영향 분석",
      text: "고객사·품번별 매출-원가를 분석해 손익 영향을 가시화한다",
    },
    en: {
      label: "Customer P&L impact analysis",
      text: "Analyzes revenue-cost by customer/part to surface profitability impact.",
    },
  },
  {
    id: "ctr-pre-bid-completeness-check",
    track: "ai-vibe",
    category: "sales",
    kr: {
      label: "수주 5일전 누락항목 점검",
      text: "견적 제출 전 BOM·단가·포장비 누락 항목을 자동 점검한다",
    },
    en: {
      label: "Pre-bid completeness check",
      text: "Auto-checks BOM/price/packaging gaps before a quote goes out.",
    },
  },

  // ── 재무·회계 (Finance & Accounting) — cards 30–39 ───────────────────────
  {
    id: "ctr-consolidated-close-e2e",
    track: "ai-vibe",
    category: "finance",
    kr: {
      label: "연결결산 E2E 자동화",
      text: "8개 법인 데이터를 매핑·환율 적용해 연결결산을 5~7일→1일로 줄인다",
    },
    en: {
      label: "Consolidated-close E2E",
      text: "Maps 8-entity data with FX to cut consolidated close from 5–7 days to 1.",
    },
  },
  {
    id: "ctr-monthly-p-l-auto-builder",
    track: "ai-vibe",
    category: "finance",
    kr: {
      label: "월간 손익계산서 자동 작성",
      text: "원장 데이터로 월간 손익계산서를 작성하고 본부장에게 자동 회람한다",
    },
    en: {
      label: "Monthly P&L auto-builder",
      text: "Builds the monthly income statement and auto-circulates to the division head.",
    },
  },
  {
    id: "ctr-ar-ap-aging-dunning-draft",
    track: "ai-vibe",
    category: "finance",
    kr: {
      label: "AR/AP Aging 독려 메일",
      text: "AR/AP Aging을 분석하고 거래선별 독려 메일 초안을 자동 첨부한다",
    },
    en: {
      label: "AR/AP aging + dunning draft",
      text: "Analyzes AR/AP aging and auto-drafts per-account dunning emails.",
    },
  },
  {
    id: "ctr-fx-effect-calculator",
    track: "ai-vibe",
    category: "finance",
    kr: {
      label: "환율효과 자동 계산",
      text: "연결손익계산서의 환율효과를 BS 기말·PL 평균환율로 자동 분해한다",
    },
    en: {
      label: "FX-effect calculator",
      text: "Auto-decomposes FX effect using closing/average rates for consolidated P&L.",
    },
  },
  {
    id: "ctr-p-l-forecast-drafter",
    track: "ai-vibe",
    category: "finance",
    kr: {
      label: "손익 FCST 자료 작성",
      text: "실적·가정으로 손익 포캐스트 자료 초안을 자동 생성한다",
    },
    en: {
      label: "P&L forecast drafter",
      text: "Auto-drafts the profit forecast pack from actuals and assumptions.",
    },
  },
  {
    id: "ctr-close-journal-entry-drafts",
    track: "ai-vibe",
    category: "finance",
    kr: {
      label: "마감 분개 초안 자동화",
      text: "감가상각·선급·AP accrual·수익인식 분개 초안을 캘린더에 맞춰 만든다",
    },
    en: {
      label: "Close journal-entry drafts",
      text: "Drafts depreciation/prepaid/AP-accrual/revenue entries on the close calendar.",
    },
  },
  {
    id: "ctr-reconciliation-autorun",
    track: "ai-vibe",
    category: "finance",
    kr: {
      label: "reconciliation 자동 대사",
      text: "GL과 보조원장·은행·인터컴퍼니를 자동 대사하고 차이를 표시한다",
    },
    en: {
      label: "Reconciliation autorun",
      text: "Auto-reconciles GL vs sub-ledger/bank/intercompany and flags differences.",
    },
  },
  {
    id: "ctr-investment-valuation-automation",
    track: "ai-vibe",
    category: "finance",
    kr: {
      label: "투자자산 가치평가 자동화",
      text: "MOIC·DPI·RVPI·TVPI를 자동 산출하고 항등식을 검증한다",
    },
    en: {
      label: "Investment valuation automation",
      text: "Auto-computes MOIC/DPI/RVPI/TVPI and verifies the identity check.",
    },
  },
  {
    id: "ctr-fx-cash-flow-planner",
    track: "ai-vibe",
    category: "finance",
    kr: {
      label: "외화 자금수지 계획",
      text: "외화 기준 수금·지급 계획을 자동 수립해 자금수지를 예측한다",
    },
    en: {
      label: "FX cash-flow planner",
      text: "Auto-builds FX-based receipts/payments plan to forecast cash position.",
    },
  },
  {
    id: "ctr-flux-variance-commentary",
    track: "ai-vibe",
    category: "finance",
    kr: {
      label: "Flux 변동분석 코멘트",
      text: "5%·10% 변동 항목을 자동 식별하고 flux 코멘트 초안을 단다",
    },
    en: {
      label: "Flux variance commentary",
      text: "Auto-flags 5%/10% movers and drafts flux variance comments.",
    },
  },

  // ── 연구개발 (R&D) — cards 40–47 ─────────────────────────────────────────
  {
    id: "ctr-design-spec-data-builder",
    track: "ai-vibe",
    category: "rnd",
    kr: {
      label: "설계사양서 데이터 축적",
      text: "DESIGN TABLE 기반으로 설계사양서를 자동 작성·축적한다",
    },
    en: {
      label: "Design-spec data builder",
      text: "Auto-builds and accumulates design specs from the DESIGN TABLE.",
    },
  },
  {
    id: "ctr-sor-key-requirement-extractor",
    track: "ai-vibe",
    category: "rnd",
    kr: {
      label: "고객 SOR 핵심요구 추출",
      text: "고객 SOR에서 핵심 요구사양 5개를 자동 추출·정리한다",
    },
    en: {
      label: "SOR key-requirement extractor",
      text: "Auto-extracts the 5 key requirements from a customer SOR.",
    },
  },
  {
    id: "ctr-scoped-external-data-monitor",
    track: "ai-vibe",
    category: "rnd",
    kr: {
      label: "외부 데이터 모니터링(3분야)",
      text: "3개 분야로 한정한 외부 데이터를 자동 수집·이상 패턴 요약한다",
    },
    en: {
      label: "Scoped external-data monitor",
      text: "Auto-collects external data limited to 3 domains and summarizes anomalies.",
    },
  },
  {
    id: "ctr-tech-doc-patent-summarizer",
    track: "ai-vibe",
    category: "rnd",
    kr: {
      label: "기술문서·특허 요약",
      text: "특허·논문·기술문서를 요약해 설계 검토 시간을 단축한다",
    },
    en: {
      label: "Tech-doc & patent summarizer",
      text: "Summarizes patents/papers/tech docs to shorten design review.",
    },
  },
  {
    id: "ctr-dfmea-draft-generator",
    track: "ai-vibe",
    category: "rnd",
    kr: {
      label: "DFMEA 초안 생성",
      text: "유사 부품 이력으로 DFMEA·DVP 초안을 자동 작성한다",
    },
    en: {
      label: "DFMEA draft generator",
      text: "Drafts DFMEA/DVP from similar-part history.",
    },
  },
  {
    id: "ctr-apqp-gate-checklist",
    track: "ai-vibe",
    category: "rnd",
    kr: {
      label: "APQP 게이트 점검표",
      text: "APQP Gate 1~5 산출물 누락 여부를 자동 점검한다",
    },
    en: {
      label: "APQP gate checklist",
      text: "Auto-checks for missing deliverables across APQP Gates 1–5.",
    },
  },
  {
    id: "ctr-design-change-impact-review",
    track: "ai-vibe",
    category: "rnd",
    kr: {
      label: "설계변경 영향성 리뷰",
      text: "제어사양 변경의 소스코드·문서 영향성을 자동 검토한다",
    },
    en: {
      label: "Design-change impact review",
      text: "Auto-reviews source-code/doc impact of control-spec changes.",
    },
  },
  {
    id: "ctr-engineering-order-timing-tracker",
    track: "ai-vibe",
    category: "rnd",
    kr: {
      label: "EO 적용시점 관리",
      text: "설계변경(EO) 적용 시점과 이력을 자동 추적·관리한다",
    },
    en: {
      label: "Engineering-order timing tracker",
      text: "Auto-tracks engineering-order application timing and history.",
    },
  },

  // ── IT·데이터 (IT & Data) — cards 48–55 ──────────────────────────────────
  {
    id: "ctr-part-number-lineage-tracker",
    track: "ai-vibe",
    category: "itdata",
    kr: {
      label: "품번 라이니지 트래커",
      text: "CRM→SAP 전 과정의 품번 수명·이력을 한 화면으로 추적한다",
    },
    en: {
      label: "Part-number lineage tracker",
      text: "Tracks part lifecycle/history CRM→SAP in a single view.",
    },
  },
  {
    id: "ctr-bom-change-cost-retrigger",
    track: "ai-vibe",
    category: "itdata",
    kr: {
      label: "BOM 변경 원가 재계산 트리거",
      text: "BOM 변경 시 표준원가 재계산을 자동 트리거해 누락을 막는다",
    },
    en: {
      label: "BOM-change cost retrigger",
      text: "Auto-triggers standard-cost recalc on BOM change to prevent stale costs.",
    },
  },
  {
    id: "ctr-mdm-permission-usage-analysis",
    track: "ai-vibe",
    category: "itdata",
    kr: {
      label: "MDM 권한자 활동 분석",
      text: "~100명 MDM 권한자의 변경 활동 패턴을 분석해 권한을 정리한다",
    },
    en: {
      label: "MDM permission-usage analysis",
      text: "Analyzes ~100 MDM editors' change patterns to rationalize access.",
    },
  },
  {
    id: "ctr-3-system-consistency-check",
    track: "ai-vibe",
    category: "itdata",
    kr: {
      label: "3시스템 정합성 샘플 점검",
      text: "PLM·MDM·SAP의 BOM을 샘플 대조해 정합성 오류를 찾는다",
    },
    en: {
      label: "3-system consistency check",
      text: "Sample-compares BOM across PLM/MDM/SAP to find mismatches.",
    },
  },
  {
    id: "ctr-heterogeneous-excel-mapper",
    track: "ai-vibe",
    category: "itdata",
    kr: {
      label: "이기종 Excel 매핑 스킬",
      text: "5개 사업장의 상이한 Excel 양식을 자동 매핑하는 스킬을 만든다",
    },
    en: {
      label: "Heterogeneous-Excel mapper",
      text: "Builds a skill that auto-maps differing Excel formats across 5 sites.",
    },
  },
  {
    id: "ctr-material-code-lead-time-analysis",
    track: "ai-vibe",
    category: "itdata",
    kr: {
      label: "자재코드 리드타임 분해",
      text: "자재코드 생성 평균 5일의 단계별 분포를 자동 분석한다",
    },
    en: {
      label: "Material-code lead-time analysis",
      text: "Auto-analyzes the step distribution of the 5-day material-code creation.",
    },
  },
  {
    id: "ctr-auto-kpi-dashboard-publisher",
    track: "ai-vibe",
    category: "itdata",
    kr: {
      label: "KPI 대시보드 자동 발행",
      text: "SAP 추출 데이터를 HTML KPI 대시보드로 무료 호스팅 발행한다",
    },
    en: {
      label: "Auto KPI dashboard publisher",
      text: "Publishes SAP-extracted data as a free-hosted HTML KPI dashboard.",
    },
  },
  {
    id: "ctr-team-report-output-automation",
    track: "ai-vibe",
    category: "itdata",
    kr: {
      label: "팀 보고문서 산출 자동화",
      text: "업무리스트·주간보고·유지보수 내역을 공통 스키마로 자동 생성한다",
    },
    en: {
      label: "Team-report output automation",
      text: "Auto-generates task lists/weekly reports/maintenance logs on a shared schema.",
    },
  },

  // ── 경영기획·전략 (Planning & Strategy) — cards 56–63 ────────────────────
  {
    id: "ctr-lme-linked-p-l-diagnosis",
    track: "ai-vibe",
    category: "strategy",
    kr: {
      label: "알루미늄 LME 손익 연동",
      text: "매입 LME 즉시반영 vs 판가 지연 GAP으로 손익변동을 진단한다",
    },
    en: {
      label: "LME-linked P&L diagnosis",
      text: "Diagnoses P&L swings from instant-LME-purchase vs lagged-price gap.",
    },
  },
  {
    id: "ctr-deep-profitability-analytics",
    track: "ai-vibe",
    category: "strategy",
    kr: {
      label: "심화 수익성 분석",
      text: "119개국 고객·품번별 손익을 통합해 수익관리로 전환한다",
    },
    en: {
      label: "Deep profitability analytics",
      text: "Unifies P&L by 119-country customers/parts to shift to profit management.",
    },
  },
  {
    id: "ctr-monthly-kpi-auto-aggregation",
    track: "ai-vibe",
    category: "strategy",
    kr: {
      label: "KPI 월간 자동 집계",
      text: "본부 KPI를 월별 자동 집계하고 전월 대비 변동을 식별한다",
    },
    en: {
      label: "Monthly KPI auto-aggregation",
      text: "Auto-aggregates HQ KPIs monthly and flags month-over-month movers.",
    },
  },
  {
    id: "ctr-global-top10-competitor-scan",
    track: "ai-vibe",
    category: "strategy",
    kr: {
      label: "경쟁사 글로벌 TOP10 분석",
      text: "글로벌 상위 10개 경쟁사 정보를 자동 수집·비교 분석한다",
    },
    en: {
      label: "Global TOP10 competitor scan",
      text: "Auto-collects and compares the global top-10 competitors.",
    },
  },
  {
    id: "ctr-product-market-share-tracker",
    track: "ai-vibe",
    category: "strategy",
    kr: {
      label: "제품별 M/S 트래킹",
      text: "제품별 시장점유율을 추적해 'Action or Out' 판단을 지원한다",
    },
    en: {
      label: "Product market-share tracker",
      text: "Tracks per-product market share to support 'Action or Out' calls.",
    },
  },
  {
    id: "ctr-ir-board-briefing-builder",
    track: "ai-vibe",
    category: "strategy",
    kr: {
      label: "IR·이사회 안건 브리핑",
      text: "월간 경영실적을 이사회 안건·IR Q&A 브리핑으로 자동 정리한다",
    },
    en: {
      label: "IR & board briefing builder",
      text: "Auto-turns monthly results into board-agenda/IR-Q&A briefings.",
    },
  },
  {
    id: "ctr-new-model-quote-simulation",
    track: "ai-vibe",
    category: "strategy",
    kr: {
      label: "신규 차종 견적 시뮬레이션",
      text: "신규 차종 부품의 가격·물량 시나리오를 자동 시뮬레이션한다",
    },
    en: {
      label: "New-model quote simulation",
      text: "Auto-simulates price/volume scenarios for a new-vehicle part.",
    },
  },
  {
    id: "ctr-sales-order-detail-analysis",
    track: "ai-vibe",
    category: "strategy",
    kr: {
      label: "영업오더 상세 분석",
      text: "영업 오더를 개발본부 관점으로 상세 분석해 반영점을 도출한다",
    },
    en: {
      label: "Sales-order detail analysis",
      text: "Analyzes sales orders from R&D's view to surface action points.",
    },
  },

  // ── 인사·총무·법무 (HR · Admin · Legal) — cards 64–70 ────────────────────
  {
    id: "ctr-ehs-regulation-monitor",
    track: "ai-vibe",
    category: "people",
    kr: {
      label: "EHS 법규 변경 모니터링",
      text: "법제처 API로 46개 법령·자치법규 변경을 감지·적용성 분석한다",
    },
    en: {
      label: "EHS regulation monitor",
      text: "Detects 46-law + ordinance changes via the law API and assesses applicability.",
    },
  },
  {
    id: "ctr-contract-risk-clause-review",
    track: "ai-vibe",
    category: "people",
    kr: {
      label: "계약서 독소조항 검토",
      text: "계약서의 위험 조항·누락 항목을 자동 하이라이트한다",
    },
    en: {
      label: "Contract risk-clause review",
      text: "Auto-highlights risky clauses and missing terms in contracts.",
    },
  },
  {
    id: "ctr-inbox-to-task-triage",
    track: "ai-vibe",
    category: "people",
    kr: {
      label: "수신 메일 업무·일정 전환",
      text: "수신 메일을 업무·일정으로 자동 전환하고 후속 대응을 관리한다",
    },
    en: {
      label: "Inbox-to-task triage",
      text: "Auto-converts incoming mail into tasks/schedule and manages follow-up.",
    },
  },
  {
    id: "ctr-global-headcount-roll-up",
    track: "ai-vibe",
    category: "people",
    kr: {
      label: "글로벌 인원현황 자동 취합",
      text: "6개국 법인 인원현황을 단일 리포트로 자동 집계한다",
    },
    en: {
      label: "Global headcount roll-up",
      text: "Auto-consolidates 6-country headcount into one report.",
    },
  },
  {
    id: "ctr-6-country-labor-law-compare",
    track: "ai-vibe",
    category: "people",
    kr: {
      label: "6개국 노동법 비교",
      text: "6개국 노동법 차이를 질의 기반으로 비교 분석한다",
    },
    en: {
      label: "6-country labor-law compare",
      text: "Compares labor-law differences across 6 countries on demand.",
    },
  },
  {
    id: "ctr-grant-notice-monitor",
    track: "ai-vibe",
    category: "people",
    kr: {
      label: "지원사업 공고 모니터링",
      text: "정부 지원사업 공고를 자동 감지하고 핵심요건을 추출한다",
    },
    en: {
      label: "Grant-notice monitor",
      text: "Auto-detects government grant notices and extracts key requirements.",
    },
  },
  {
    id: "ctr-plan-permit-drafter",
    track: "ai-vibe",
    category: "people",
    kr: {
      label: "사업계획서·인허가 초안",
      text: "태양광 사업계획서·인허가 서류 초안을 3~5일→1일로 작성한다",
    },
    en: {
      label: "Plan & permit drafter",
      text: "Drafts solar business plans/permit docs, 3–5 days → 1 day.",
    },
  },
];
