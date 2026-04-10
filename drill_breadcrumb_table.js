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
    }
  },

  create: function(element, config) {
    element.innerHTML = `
      <style>
        .viz-container { font-family: 'Open Sans', Helvetica, Arial, sans-serif; padding: 10px; height: 100%; overflow: hidden; }
        .breadcrumbs { font-size: 14px; margin-bottom: 15px; font-weight: bold; color: #333; }
        .breadcrumb-link { color: #4285F4; cursor: pointer; text-decoration: none; }
        .viz-table { width: 100%; border-collapse: collapse; }
        .viz-table th { text-align: left; font-size: 11px; color: #707781; border-bottom: 1px solid #EAEAEA; padding: 8px; text-transform: uppercase; }
        .viz-table td { padding: 10px 8px; border-bottom: 1px solid #F5F5F5; font-size: 13px; color: #262D33; }
        .bar-bg { background: #f0f0f0; height: 22px; width: 100%; position: relative; cursor: pointer; }
        .bar-fill { height: 100%; transition: width 0.4s ease-out; }
        .bar-label { position: absolute; right: -55px; top: 3px; font-size: 11px; color: #333; }
        .drill-menu-popup {
          position: fixed; background: white; border: 1px solid #d1d1d1;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none; z-index: 2000;
          min-width: 180px; border-radius: 4px; padding: 5px 0;
        }
        .menu-header { padding: 8px 15px; font-size: 11px; color: #999; border-bottom: 1px solid #eee; text-transform: uppercase; }
        .menu-item { padding: 10px 15px; cursor: pointer; font-size: 13px; }
        .menu-item:hover { background: #F5F7F9; color: #4285F4; }
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
    this.drillStack = []; // Stores objects: { fieldName: '...', value: '...' }
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.data = data;
    this.fields = queryResponse.fields;
    this.config = config;
    this.render();
    done();
  },

  render: function() {
    const body = document.getElementById('body');
    const head = document.getElementById('headers');
    const nav = document.getElementById('nav');
    const menu = document.getElementById('mini-menu');
    body.innerHTML = "";

    const dims = this.fields.dimension_like;
    const meas = this.fields.measure_like[0];
    const currentDimIndex = this.drillStack.length;
    const currentDim = dims[currentDimIndex];

    // 1. Render Breadcrumbs Dynamically
    let navHTML = `<span class="breadcrumb-link" id="drill-root">Home</span>`;
    this.drillStack.forEach((step, i) => {
      navHTML += ` <span style="color:#999">></span> <span class="breadcrumb-link drill-back" data-index="${i}">${step.value}</span>`;
    });
    navHTML += ` <span style="color:#999">></span> <span style="color:#000">Current Viz</span>`;
    nav.innerHTML = navHTML;

    // 2. Aggregate Data based on Drill Path
    // Even if 3 dims are selected, we filter by the stack and sum the measure for the current level
    let filteredData = this.data;
    this.drillStack.forEach((step, i) => {
      filteredData = filteredData.filter(d => d[dims[i].name].value === step.value);
    });

    const aggregated = {};
    filteredData.forEach(row => {
      const key = row[currentDim.name].value;
      const val = row[meas.name].value || 0;
      if (!aggregated[key]) aggregated[key] = 0;
      aggregated[key] += val;
    });

    const sortedKeys = Object.keys(aggregated).sort((a,b) => aggregated[b] - aggregated[a]);
    const maxVal = Math.max(...Object.values(aggregated));

    // 3. Render Table Headers
    head.innerHTML = `<th>${currentDim.label_short}</th><th>${meas.label_short}</th>`;

    // 4. Render Rows
    sortedKeys.forEach(key => {
      const val = aggregated[key];
      const pct = (val / maxVal) * 100;
      const tr = document.createElement('tr');
      
      tr.innerHTML = `
        <td style="width:30%; cursor:pointer; font-weight:600;">${key}</td>
        <td style="width:70%;">
          <div class="bar-bg">
            <div class="bar-fill" style="width:${pct}%; background:${this.config.bar_color}"></div>
            <span class="bar-label">${val.toLocaleString()}</span>
          </div>
        </td>
      `;

      tr.onclick = (e) => {
        // Only show menu if there are more dimensions to drill into
        if (currentDimIndex < dims.length - 1) {
          this.showDynamicMenu(e, key, menu, dims, currentDimIndex);
        }
      };
      body.appendChild(tr);
    });

    // Navigation Events
    document.getElementById('drill-root').onclick = () => { this.drillStack = []; this.render(); };
    document.querySelectorAll('.drill-back').forEach(el => {
      el.onclick = (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'));
        this.drillStack = this.drillStack.slice(0, idx + 1);
        this.render();
      };
    });
    window.onclick = () => menu.style.display = 'none';
  },

  showDynamicMenu: function(e, value, menu, dims, currentIndex) {
    e.stopPropagation();
    menu.style.display = 'block';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    let menuHTML = `<div class="menu-header">Drill into ${value}</div>`;
    
    // Dynamically create menu items for all remaining dimensions
    for (let i = currentIndex + 1; i < dims.length; i++) {
      menuHTML += `<div class="menu-item" data-dim-index="${i}">by ${dims[i].label_short}</div>`;
    }
    menu.innerHTML = menuHTML;

    // Attach click events to dynamic menu items
    menu.querySelectorAll('.menu-item').forEach(item => {
      item.onclick = () => {
        this.drillStack.push({ value: value });
        this.render();
      };
    });
  }
});
