/**
 * TankRate — chart.js
 * Chart.js wrapper: renders 3-line price history chart
 */
(function () {
  "use strict";

  window.renderChart = function (historyData) {
    const container = document.getElementById("price-chart");
    if (!container) return;

    let canvas = document.getElementById("price-chart-canvas");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "price-chart-canvas";
      container.innerHTML = "";
      container.appendChild(canvas);
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fuelKeys = ["petrol", "diesel", "lpg"];
    const colors = {
      petrol: "#1B7F8E",
      diesel: "#2C5F8A",
      lpg: "#27AE60"
    };

    const datasets = fuelKeys.map((key) => {
      const points = historyData
        .filter((d) => d.fuel_type === key)
        .map((d) => ({ x: d.date, y: d.price }));
      return {
        label: key.charAt(0).toUpperCase() + key.slice(1),
        data: points,
        borderColor: colors[key],
        backgroundColor: colors[key] + "20",
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
        fill: false,
      };
    });

    if (window.__priceChart) window.__priceChart.destroy();

    window.__priceChart = new Chart(ctx, {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            position: "top",
            labels: {
              usePointStyle: true,
              padding: 20,
              font: { family: "Inter", size: 12 },
              color: getComputedStyle(document.documentElement).getPropertyValue("--color-text").trim() || "#1A202C",
            },
          },
          tooltip: {
            backgroundColor: "#0D1B2A",
            titleFont: { family: "Barlow Condensed", size: 14 },
            bodyFont: { family: "Inter", size: 12 },
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.y.toFixed(2)}`,
            },
          },
        },
        scales: {
          x: {
            type: "category",
            ticks: { maxTicksLimit: 8, font: { size: 10 }, color: "#718096" },
            grid: { display: false },
          },
          y: {
            ticks: {
              callback: (v) => `${v}`,
              font: { size: 10 },
              color: "#718096",
            },
            grid: { color: "#E2E8F0" },
          },
        },
      },
    });
  };
})();
