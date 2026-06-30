(function () {
  const source = document.getElementById("chart-data");
  if (!source) {
    return;
  }

  const data = JSON.parse(source.textContent);
  drawBars('[data-chart="totals"]', data.monthly.totals);
  drawBars('[data-chart="expenses"]', data.monthly.expenses);
  drawTrend('[data-chart="trend"]', data.trend);

  function drawBars(selector, items) {
    const node = document.querySelector(selector);
    if (!node) {
      return;
    }
    if (!items.length) {
      node.innerHTML = '<p class="empty">No data for this period.</p>';
      return;
    }

    const max = Math.max(...items.map((item) => Math.abs(item.value)), 1);
    const bars = items
      .map((item) => {
        const height = Math.max(8, Math.round((Math.abs(item.value) / max) * 150));
        return `
          <div class="bar-item">
            <div class="bar-track"><span style="height:${height}px"></span></div>
            <strong>${money(item.value)}</strong>
            <em>${escapeHtml(item.label)}</em>
          </div>
        `;
      })
      .join("");
    node.innerHTML = `<div class="bar-chart">${bars}</div>`;
  }

  function drawTrend(selector, items) {
    const node = document.querySelector(selector);
    if (!node) {
      return;
    }
    if (!items.length) {
      node.innerHTML = '<p class="empty">No trend data yet.</p>';
      return;
    }

    const width = 720;
    const height = 220;
    const padding = 28;
    const values = items.flatMap((item) => [item.income, item.expenses, item.net]);
    const min = Math.min(0, ...values);
    const max = Math.max(1, ...values);
    const span = max - min || 1;

    function point(value, index) {
      const x = padding + (index * (width - padding * 2)) / Math.max(items.length - 1, 1);
      const y = height - padding - ((value - min) / span) * (height - padding * 2);
      return `${x},${y}`;
    }

    const income = items.map((item, index) => point(item.income, index)).join(" ");
    const expenses = items.map((item, index) => point(item.expenses, index)).join(" ");
    const net = items.map((item, index) => point(item.net, index)).join(" ");
    const labels = items
      .map((item, index) => {
        const x = padding + (index * (width - padding * 2)) / Math.max(items.length - 1, 1);
        return `<text x="${x}" y="${height - 5}" text-anchor="middle">${escapeHtml(item.label.slice(5))}</text>`;
      })
      .join("");

    node.innerHTML = `
      <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Six-month financial trend">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
        <polyline class="series income-line" points="${income}"></polyline>
        <polyline class="series expense-line" points="${expenses}"></polyline>
        <polyline class="series net-line" points="${net}"></polyline>
        ${labels}
      </svg>
      <div class="legend">
        <span class="income-dot">Income</span>
        <span class="expense-dot">Expenses</span>
        <span class="net-dot">Net</span>
      </div>
    `;
  }

  function money(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
})();

