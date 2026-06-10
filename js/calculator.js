/**
 * TankRate — calculator.js
 * All calculator logic: pre-fill from API, live recalculation
 */
(function () {
  "use strict";

  window.initCalculator = function (pricesData) {
    const container = qs("#calculator-app");
    if (!container) return;

    const symbol = pricesData.symbol || "$";
    const unit = window.__unit || pricesData.unit_default || "litre";

    const petrolPrice = pricesData.prices?.petrol?.price ?? 1.5;
    const dieselPrice = pricesData.prices?.diesel?.price ?? 1.6;
    const lpgPrice = pricesData.prices?.lpg?.price ?? 0.8;

    container.innerHTML = `
      <div class="calc-wrapper">
        <div class="calc-inputs">
          <h3>Fuel Details</h3>
          <div class="form-group">
            <label>Fuel type</label>
            <div class="toggle-group" id="fuel-type-toggle">
              <button class="active" data-fuel="petrol">Petrol</button>
              <button data-fuel="diesel">Diesel</button>
              <button data-fuel="lpg">LPG</button>
            </div>
          </div>
          <div class="form-group">
            <label for="calc-price">Current price (${symbol}/${unit})</label>
            <input type="number" id="calc-price" step="0.001" value="${petrolPrice.toFixed(3)}">
          </div>
          <div class="form-group">
            <label for="calc-tank">Tank size (${unit})</label>
            <input type="number" id="calc-tank" step="1" value="50">
          </div>
          <div class="form-group">
            <label>Consumption unit</label>
            <div class="toggle-group" id="unit-toggle">
              <button class="active" data-unit="l100km">L/100km</button>
              <button data-unit="mpg">MPG</button>
            </div>
          </div>
          <div class="form-group">
            <label for="calc-consumption">Consumption</label>
            <input type="number" id="calc-consumption" step="0.1" value="7">
          </div>
          <div class="form-group">
            <label for="calc-mileage">Weekly distance (${unit === 'gallon' ? 'miles' : 'km'})</label>
            <input type="number" id="calc-mileage" step="1" value="200">
          </div>
        </div>

        <div class="calc-results">
          <h3>Your Fuel Costs</h3>
          <div class="calc-result-row">
            <span class="label">Cost per full tank</span>
            <span class="value" id="res-tank">${symbol}${(petrolPrice * 50).toFixed(2)}</span>
          </div>
          <div class="calc-result-row">
            <span class="label">Weekly fuel cost</span>
            <span class="value" id="res-week">—</span>
          </div>
          <div class="calc-result-row">
            <span class="label">Monthly fuel cost</span>
            <span class="value" id="res-month">—</span>
          </div>
          <div class="calc-result-row">
            <span class="label">Annual fuel cost</span>
            <span class="value" id="res-year">—</span>
          </div>
          <div class="calc-result-row">
            <span class="label">CO₂ estimate (kg/year)</span>
            <span class="value" id="res-co2">—</span>
          </div>
          <div class="calc-savings" id="savings-card" style="display:none">
            Switch to LPG: save <span id="savings-amount">—</span>/year
          </div>
        </div>
      </div>
      <div class="ad-placeholder ad-rectangle" style="max-width:336px;height:280px;margin:1rem auto">Ad — 336×280</div>
    `;

    let fuelType = "petrol";
    let consumptionUnit = "l100km";

    function toLitresPer100(val, unit) {
      if (unit === "mpg") return 235.214583 / val;
      return val;
    }
    function co2PerKm(fuel, l100) {
      const factors = { petrol: 2.31, diesel: 2.68, lpg: 1.64 };
      return l100 * (factors[fuel] ?? 2.31) / 100;
    }

    function recalc() {
      const price = parseFloat(qs("#calc-price").value) || 0;
      const tank = parseFloat(qs("#calc-tank").value) || 0;
      const consumption = parseFloat(qs("#calc-consumption").value) || 0;
      const mileage = parseFloat(qs("#calc-mileage").value) || 0;

      const l100 = toLitresPer100(consumption, consumptionUnit);
      const weeklyL = (l100 * mileage) / 100;
      const tankCost = price * tank;
      const weeklyCost = price * weeklyL;
      const monthlyCost = weeklyCost * 4.33;
      const annualCost = weeklyCost * 52;
      const annualCO2 = co2PerKm(fuelType, l100) * mileage * 52;

      setText("res-tank", `${symbol}${tankCost.toFixed(2)}`);
      setText("res-week", `${symbol}${weeklyCost.toFixed(2)}`);
      setText("res-month", `${symbol}${monthlyCost.toFixed(2)}`);
      setText("res-year", `${symbol}${annualCost.toFixed(2)}`);
      setText("res-co2", `${annualCO2.toFixed(0)} kg`);

      if (fuelType !== "lpg") {
        const lpgP = pricesData.prices?.lpg?.price ?? 0.8;
        const lpgAnnual = l100 * mileage * 52 / 100 * lpgP;
        const savings = annualCost - lpgAnnual;
        const savingsCard = qs("#savings-card");
        if (savingsCard && savings > 0) {
          savingsCard.style.display = "block";
          setText("savings-amount", `${symbol}${savings.toFixed(2)}`);
        } else if (savingsCard) {
          savingsCard.style.display = "none";
        }
      } else {
        hide("savings-card");
      }
    }

    qsa("#fuel-type-toggle button").forEach(btn => {
      btn.addEventListener("click", () => {
        qsa("#fuel-type-toggle button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        fuelType = btn.dataset.fuel;
        const prices = { petrol: petrolPrice, diesel: dieselPrice, lpg: lpgPrice };
        (qs("#calc-price")).value = prices[fuelType].toFixed(3);
        recalc();
      });
    });

    qsa("#unit-toggle button").forEach(btn => {
      btn.addEventListener("click", () => {
        qsa("#unit-toggle button").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        consumptionUnit = btn.dataset.unit;
        (qs("#calc-consumption")).value =
          consumptionUnit === "mpg" ? (235 / 7).toFixed(1) : "7";
        recalc();
      });
    });

    qsa("#calculator-app input").forEach(inp => {
      inp.addEventListener("input", recalc);
    });

    recalc();
  };
})();
