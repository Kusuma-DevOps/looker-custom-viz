looker.plugins.visualizations.add({
  options: {
    bar_color: {
      type: "string",
      label: "Bar Color",
      default: "#E52592",
      display: "color",
      section: "Styling"
    },
    show_row_numbers: {
      type: "boolean",
      label: "Show Row Numbers",
      default: true,
      section: "Styling"
    },
    // NEW OPTION: Toggle values on bars
    show_values: {
      type: "boolean",
      label: "Show Values",
      default: true,
      section: "Styling"
    }
  },

  create: function(element, config) {
    element.innerHTML = `
      <style>
        .viz-container { font-family: 'Open Sans', Helvetica, Arial, sans-serif; padding: 10px; height: 100%; overflow: hidden; }
        .breadcrumbs { font-size: 14px; margin-bottom: 15px; font-weight: bold; color: #333; }
        .breadcrumb-link { color: #4285F4; cursor: pointer; text-decoration: none; }
        .breadcrumb-link:hover { text-decoration: underline; }
        .viz-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .viz-table th { text-align: left; font-size: 11px; color: #707781; border-bottom: 1px solid #EAEAEA; padding: 8px; text-transform: uppercase; }
        .viz-table td { padding: 10px 8px; border-bottom: 1px solid #F5F5F5; font-size: 13px; color: #262D33; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .bar-bg { background: #f0f0f0; height: 22px; width: 100%; position: relative; cursor: pointer; }
        .bar-fill { height: 100%; transition: width 0.4s ease-out; }
        .bar-label { position: absolute; right: 5px; top: 3px; font-size: 11px; color: #333; font-weight: bold; text-shadow: 0px 0px 2px #fff; }
        .drill-menu-popup {
          position: fixed; background: white; border: 1px solid #d1d1d1;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none; z-index: 2000;
          min-width: 180px; border-radius: 4px; padding: 5px 0;
        }
        .menu-header { padding: 8px 15px; font-size: 11px; color: #999; border-bottom: 1px solid #eee; text-transform: uppercase; }
        .menu-item { padding: 10px 15px; cursor: pointer; font-size: 13px; }
        .menu-item:hover { background: #F5F7F9; color: #4285F4; }
        .col-row-num { width: 30px; color: #C1C1C1 !important; font-size: 11px !important; }
      </style>
      <div class="viz-container">
        <div id="nav" class="breadcrumbs"></div>
        <div id="mini-menu" class="drill-menu-popup"></div>
        <table class="viz-table">
          <thead><tr id="headers"></tr></thead>
          <tbody id="body"></tbody>
        </table>
      </div>
    `;
    this.drillStack = [];
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.data   = data;
    this.fields = queryResponse.fields;
    this.config = config;
    this.render();
    done();
  },

  render: function() {
    const body = document.getElementById('body');
    const head = document.getElementById('headers');
    const nav  = document.getElementById('nav');
    const menu = document.getElementById('mini-menu');
    body.innerHTML = "";

    const dims = this.fields.dimension_like;
    const meas = this.fields.measure_like[0];

    if (!dims || dims.length === 0 || !meas) {
      body.innerHTML = '<tr><td colspan="3" style="padding:20px;text-align:center;color:#999">Add at least one dimension and one measure.</td></tr>';
      return;
    }

    const currentDimIndex = this.drillStack.length === 0
      ? 0
      : this.drillStack[this.drillStack.length - 1].nextDimIndex;

    const currentDim = dims[currentDimIndex];
    if (!currentDim) return;

    // ── 1. Breadcrumbs ─────────────────────────────────────
    let navHTML = `<span class="breadcrumb-link" id="drill-root">Home</span>`;
    this.drillStack.forEach((step, i) => {
      navHTML += ` <span style="color:#999">›</span> `;
      navHTML += `<span class="breadcrumb-link drill-back" data-index="${i}">${step.value}</span>`;
    });
    navHTML += ` <span style="color:#999">›</span> <span style="color:#000">${currentDim.label_short || currentDim.label}</span>`;
    nav.innerHTML = navHTML;

    // ── 2. Filter data ──────────────────────────────────────
    let filteredData = this.data;
    this.drillStack.forEach((step) => {
      filteredData = filteredData.filter(row => {
        const cell = row[step.fieldName];
        return cell && String(cell.value) === step.value;
      });
    });

    // ── 3. Aggregate ────────────────────────────────────────
    const aggregated = {};
    filteredData.forEach(row => {
      const dCell = row[currentDim.name];
      const mCell = row[meas.name];
      if (!dCell) return;
      const key = dCell.value != null ? String(dCell.value) : "(null)";
      const val = mCell && mCell.value != null ? Number(mCell.value) : 0;
      if (!aggregated[key]) aggregated[key] = 0;
      aggregated[key] += isNaN(val) ? 0 : val;
    });

    const sortedKeys = Object.keys(aggregated).sort((a, b) => aggregated[b] - aggregated[a]);
    const maxVal     = sortedKeys.length > 0 ? Math.max(...Object.values(aggregated)) : 1;

    // ── 4. Headers (Respecting Row Numbers) ─────────────────
    const dimLabel  = currentDim.label_short || currentDim.label;
    const measLabel = meas.label_short || meas.label;
    
    let headerHTML = "";
    if (this.config.show_row_numbers) {
      headerHTML += `<th class="col-row-num">#</th>`;
    }
    headerHTML += `<th style="width:35%">${dimLabel}</th><th style="width:65%">${measLabel}</th>`;
    head.innerHTML = headerHTML;

    // ── 5. Rows ────────────────────────────────────────────
    const canDrill = currentDimIndex < dims.length - 1;

    sortedKeys.forEach((key, index) => {
      const val = aggregated[key];
      const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
      const tr  = document.createElement('tr');

      // Check if we should show the value label
      const valueLabel = this.config.show_values ? `<span class="bar-label">${val.toLocaleString()}</span>` : '';

      let rowHTML = "";
      if (this.config.show_row_numbers) {
        rowHTML += `<td class="col-row-num">${index + 1}</td>`;
      }

      rowHTML += `
        <td style="${canDrill ? 'cursor:pointer;font-weight:600;color:#4285F4;' : ''}">${key}</td>
        <td>
          <div class="bar-bg">
            <div class="bar-fill" style="width:${pct}%;background:${this.config.bar_color || '#E52592'}"></div>
            ${valueLabel}
          </div>
        </td>
      `;
      
      tr.innerHTML = rowHTML;

      if (canDrill) {
        tr.onclick = (e) => {
          this.showDynamicMenu(e, key, menu, dims, currentDimIndex, currentDim.name);
        };
      }
      body.appendChild(tr);
    });

    // ── 6. Breadcrumb navigation ───────────────────────────
    document.getElementById('drill-root').onclick = () => {
      this.drillStack = [];
      this.render();
    };

    document.querySelectorAll('.drill-back').forEach(el => {
      el.onclick = (e) => {
        e.stopPropagation();
        const idx = parseInt(e.target.getAttribute('data-index'));
        this.drillStack = this.drillStack.slice(0, idx + 1);
        this.render();
      };
    });

    window.onclick = () => { menu.style.display = 'none'; };
  },

  showDynamicMenu: function(e, value, menu, dims, currentIndex, currentFieldName) {
    e.stopPropagation();

    menu.style.display = 'block';
    menu.style.left    = e.clientX + 'px';
    menu.style.top     = (e.clientY + 4) + 'px';

    let menuHTML = `<div class="menu-header">Drill into ${value}</div>`;
    for (let i = currentIndex + 1; i < dims.length; i++) {
      const label = dims[i].label_short || dims[i].label;
      menuHTML += `<div class="menu-item" data-dim-index="${i}">by ${label}</div>`;
    }
    menu.innerHTML = menuHTML;

    menu.querySelectorAll('.menu-item').forEach(item => {
      item.onclick = (ev) => {
        ev.stopPropagation();
        const targetDimIndex = parseInt(item.getAttribute('data-dim-index'));
        this.drillStack.push({
          fieldName:    currentFieldName,
          value:        value,
          nextDimIndex: targetDimIndex
        });
        menu.style.display = 'none';
        this.render();
      };
    });
  }
});
