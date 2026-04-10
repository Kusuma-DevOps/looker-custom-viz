looker.plugins.visualizations.add({
  // --- THIS SECTION DEFINES THE EDIT PANEL ---
  options: {
    first_step_label: {
      type: "string",
      label: "Home Step Label",
      default: "Step 1",
      section: "Breadcrumbs",
      order: 1
    },
    drill_label_1: {
      type: "string",
      label: "First Drill Level Label",
      default: "By Sub-Category",
      section: "Drill Menu",
      order: 2
    },
    drill_label_2: {
      type: "string",
      label: "Second Drill Level Label",
      default: "By Segment",
      section: "Drill Menu",
      order: 3
    },
    bar_color: {
      type: "string",
      label: "Bar Color",
      default: "#E52592",
      display: "color",
      section: "Styling",
      order: 4
    }
  },

  create: function(element, config) {
    element.innerHTML = `
      <style>
        .viz-container { font-family: 'Open Sans', Helvetica, Arial, sans-serif; padding: 10px; height: 100%; overflow: hidden; }
        .breadcrumbs { font-size: 14px; margin-bottom: 15px; font-weight: bold; color: #333; }
        .breadcrumb-link { color: #4285F4; cursor: pointer; text-decoration: none; }
        .breadcrumb-link:hover { text-decoration: underline; }
        .viz-table { width: 100%; border-collapse: collapse; }
        .viz-table th { text-align: left; font-size: 11px; color: #707781; border-bottom: 1px solid #EAEAEA; padding: 8px; text-transform: uppercase; }
        .viz-table td { padding: 10px 8px; border-bottom: 1px solid #F5F5F5; font-size: 13px; color: #262D33; }
        
        .bar-bg { background: #f0f0f0; height: 22px; width: 100%; position: relative; cursor: pointer; border-radius: 2px; }
        .bar-fill { height: 100%; transition: width 0.4s ease-out; border-radius: 2px; }
        .bar-label { position: absolute; right: -50px; top: 3px; font-size: 11px; color: #333; font-weight: 400; }

        .drill-menu-popup {
          position: fixed; background: white; border: 1px solid #d1d1d1;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: none; z-index: 2000;
          min-width: 180px; border-radius: 4px; padding: 5px 0;
        }
        .menu-header { padding: 8px 15px; font-size: 11px; color: #999; border-bottom: 1px solid #eee; text-transform: uppercase; letter-spacing: 0.5px; }
        .menu-item { padding: 10px 15px; cursor: pointer; font-size: 13px; color: #262D33; transition: background 0.2s; }
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
    this.currentLevel = 0;
    this.filterVal = null;
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    this.data = data;
    this.fields = queryResponse.fields;
    this.config = config; // This links the Edit Panel to the JS
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

    // 1. Breadcrumbs
    let navHTML = `<span class="breadcrumb-link" id="reset">${this.config.first_step_label || 'Step 1'}</span>`;
    if (this.currentLevel > 0) {
      navHTML += ` <span style="color:#999; margin: 0 5px;">></span> <span class="breadcrumb-link" id="go-back">${this.filterVal}</span>`;
    }
    navHTML += ` <span style="color:#999; margin: 0 5px;">></span> <span style="color:#000">Current Viz</span>`;
    nav.innerHTML = navHTML;

    // 2. Data Filtering
    let displayData = this.data;
    if (this.currentLevel > 0) {
      displayData = this.data.filter(d => d[dims[0].name].value === this.filterVal);
    }

    // 3. Headers
    head.innerHTML = `<th>${dims[this.currentLevel].label_short}</th><th>${meas.label_short}</th>`;
    const maxVal = Math.max(...displayData.map(d => d[meas.name].value));

    // 4. Render Rows
    displayData.forEach(row => {
      const label = row[dims[this.currentLevel].name].value;
      const value = row[meas.name].value;
      const pct = (value / maxVal) * 100;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="width:30%; cursor:pointer; font-weight: 600;">${label}</td>
        <td style="width:70%;">
          <div class="bar-bg">
            <div class="bar-fill" style="width:${pct}%; background:${this.config.bar_color || '#E52592'}"></div>
            <span class="bar-label">${value.toLocaleString()}</span>
          </div>
        </td>
      `;

      tr.onclick = (e) => {
        if (this.currentLevel === 0) {
          this.showMenu(e, label, menu);
        }
      };
      body.appendChild(tr);
    });

    document.getElementById('reset').onclick = () => { this.currentLevel = 0; this.filterVal = null; this.render(); };
    if (this.currentLevel > 0) {
        document.getElementById('go-back').onclick = () => { this.currentLevel = 0; this.render(); };
    }
    window.onclick = () => menu.style.display = 'none';
  },

  showMenu: function(e, label, menu) {
    e.stopPropagation();
    menu.style.display = 'block';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    menu.innerHTML = `
      <div class="menu-header">Drill into ${label}</div>
      <div class="menu-item" id="opt1">${this.config.drill_label_1 || 'By Sub-Category'}</div>
      <div class="menu-item" id="opt2">${this.config.drill_label_2 || 'By Segment'}</div>
    `;

    document.getElementById('opt1').onclick = () => { this.currentLevel = 1; this.filterVal = label; this.render(); };
    document.getElementById('opt2').onclick = () => { this.currentLevel = 2; this.filterVal = label; this.render(); };
  }
});
