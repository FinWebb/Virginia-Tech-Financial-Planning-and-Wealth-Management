// ---------- Hamburger / side nav ----------
const navToggle = document.getElementById('nav-toggle');
const sideNav = document.getElementById('side-nav');
const navScrim = document.getElementById('nav-scrim');

function openNav() {
  sideNav.classList.add('open');
  navScrim.classList.add('visible');
  navToggle.classList.add('open');
  navToggle.setAttribute('aria-expanded', 'true');
  sideNav.setAttribute('aria-hidden', 'false');
}
function closeNav() {
  sideNav.classList.remove('open');
  navScrim.classList.remove('visible');
  navToggle.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
  sideNav.setAttribute('aria-hidden', 'true');
}
navToggle.addEventListener('click', () => {
  sideNav.classList.contains('open') ? closeNav() : openNav();
});
navScrim.addEventListener('click', closeNav);
document.querySelectorAll('#side-nav a[href^="#"]').forEach(a => {
  a.addEventListener('click', closeNav);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });

// ---------- Scroll progress + hamburger solid state ----------
const progressBar = document.getElementById('scroll-progress-bar');
function onScroll() {
  const doc = document.documentElement;
  const pct = (doc.scrollTop) / (doc.scrollHeight - doc.clientHeight) * 100;
  progressBar.style.width = pct + '%';
  navToggle.classList.toggle('solid', doc.scrollTop > window.innerHeight * 0.6);
}
document.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- Scroll-spy ----------
const sections = document.querySelectorAll('main > section[id]');
const navLinks = document.querySelectorAll('#side-nav a[href^="#"]');
const spy = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.id;
      navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
    }
  });
}, { rootMargin: '-45% 0px -45% 0px' });
sections.forEach(s => spy.observe(s));

// ---------- Reveal on scroll ----------
document.querySelectorAll('.fact, .pillar, .stat-card, .biz-model-card, .g-item, .contact-card, .pano, .board-card').forEach(el => el.classList.add('reveal'));
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// ---------- Animated counters ----------
const counters = document.querySelectorAll('.stat-num[data-count]');
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const el = entry.target;
    const target = parseInt(el.getAttribute('data-count'), 10);
    const suffix = el.getAttribute('data-suffix') || '';
    const dur = 1400;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    counterObserver.unobserve(el);
  });
}, { threshold: 0.4 });
counters.forEach(c => counterObserver.observe(c));

// ---------- Alumni firm map (VT-themed, adapted from student alumni map) ----------
(function() {
  if (typeof firms === 'undefined' || typeof d3 === 'undefined') return;

  let currentFirms = [];
  const grouped = {};
  firms.forEach(f => {
    const key = f[1] + ', ' + f[2];
    if (!grouped[key]) grouped[key] = { city: f[1], state: f[2], lat: f[3], lon: f[4], firms: [] };
    grouped[key].firms.push({ name: f[0], website: f[5] });
  });
  const locations = Object.values(grouped);

  const projection = d3.geoAlbersUsa().scale(1000).translate([480, 300]);
  const path = d3.geoPath().projection(projection);

  const svg = d3.select('#usa-map');
  const zoomGroup = d3.select('#zoom-group');
  const tooltip = document.getElementById('tooltip');
  const mapContainer = document.getElementById('map-container');

  function filterFirms(q) {
    const list = document.getElementById('panel-list');
    const filtered = q ? currentFirms.filter(f => f.name.toLowerCase().includes(q.toLowerCase())) : currentFirms;
    list.innerHTML = filtered.map(f => `<div class="firm-card">
      <div class="firm-name">${f.name}</div>
      ${f._city ? `<div style="font-size:11px;color:#8a8378;margin-top:1px">${f._city}</div>` : ''}
      ${f.website ? `<div class="firm-link"><a href="${f.website}" target="_blank" rel="noopener">${f.website.replace('https://www.','').replace('https://','')}</a></div>` : ''}
    </div>`).join('');
  }
  document.getElementById('firm-search').addEventListener('input', (e) => filterFirms(e.target.value));
  document.getElementById('close-btn').addEventListener('click', () => {
    document.getElementById('panel').style.display = 'none';
  });

  const locPoints = locations.map(loc => {
    const coords = projection([loc.lon, loc.lat]);
    return coords ? { x: coords[0], y: coords[1], loc } : null;
  }).filter(Boolean);
  locPoints.sort((a, b) => b.loc.firms.length - a.loc.firms.length);

  function dotRadius(firmCount) {
    return Math.min(6 + firmCount * 1.4, 24);
  }

  // Agglomerative merge: two dots combine whenever their rendered circles
  // would actually overlap (radius-aware), not just a fixed pixel gap.
  // That way any tight knot of separate cities collapses into one bubble,
  // however many of them there are, while zooming back in still splits
  // them apart as their on-screen distance grows.
  function computeClusters(scale) {
    let clusters = locPoints.map(p => ({
      cx: p.x, cy: p.y, locations: [p.loc], firmCount: p.loc.firms.length, cityCount: 1
    }));
    const pad = 6;

    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < clusters.length && !merged; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const a = clusters[i], b = clusters[j];
          const dx = a.cx - b.cx, dy = a.cy - b.cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const threshold = (dotRadius(a.firmCount) + dotRadius(b.firmCount)) / Math.sqrt(scale) + pad / scale;
          if (dist < threshold) {
            const n1 = a.locations.length, n2 = b.locations.length;
            a.cx = (a.cx * n1 + b.cx * n2) / (n1 + n2);
            a.cy = (a.cy * n1 + b.cy * n2) / (n1 + n2);
            a.locations = a.locations.concat(b.locations);
            a.firmCount += b.firmCount;
            a.cityCount = a.locations.length;
            clusters.splice(j, 1);
            merged = true;
            break;
          }
        }
      }
    }
    return clusters;
  }

  function showPanel(loc) {
    currentFirms = loc.firms;
    document.getElementById('panel-city').textContent = loc.city + ', ' + loc.state;
    const c = loc.firms.length;
    document.getElementById('panel-count').textContent = c + (c === 1 ? ' firm' : ' firms');
    const searchEl = document.getElementById('firm-search');
    searchEl.value = '';
    searchEl.style.display = c > 5 ? 'block' : 'none';
    filterFirms('');
    document.getElementById('panel').style.display = 'flex';
  }

  function showMergedPanel(cluster) {
    currentFirms = [];
    cluster.locations.forEach(loc => {
      loc.firms.forEach(f => currentFirms.push({ ...f, _city: loc.city + ', ' + loc.state }));
    });
    document.getElementById('panel-city').textContent = cluster.cityCount + ' nearby cities';
    document.getElementById('panel-count').textContent = cluster.firmCount + ' firms (zoom in to separate)';
    const searchEl = document.getElementById('firm-search');
    searchEl.value = '';
    searchEl.style.display = cluster.firmCount > 5 ? 'block' : 'none';
    filterFirms('');
    document.getElementById('panel').style.display = 'flex';
  }

  let currentScale = 1;

  function renderClusters(scale) {
    currentScale = scale;
    const clusters = computeClusters(scale);
    const dotG = d3.select('#dots');
    dotG.selectAll('g.dot').remove();

    clusters.forEach(c => {
      const isCluster = c.cityCount > 1;
      const r = dotRadius(c.firmCount);
      const fontSize = Math.min(11, r * 0.85);

      const g = dotG.append('g').attr('class', 'dot')
        .attr('transform', `translate(${c.cx},${c.cy})`)
        .style('cursor', 'pointer');

      g.append('circle')
        .attr('r', r / Math.sqrt(scale))
        .attr('fill', '#cf4420')
        .attr('fill-opacity', 0.88)
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5 / scale);

      g.append('text')
        .attr('text-anchor', 'middle').attr('dy', '0.35em')
        .attr('fill', '#fff')
        .attr('font-size', fontSize / Math.sqrt(scale))
        .attr('font-weight', '700')
        .attr('pointer-events', 'none')
        .text(c.firmCount);

      g.on('mouseenter', (event) => {
        g.select('circle').attr('fill', '#630031');
        const label = isCluster
          ? `${c.cityCount} cities · ${c.firmCount} firms`
          : `${c.locations[0].city}, ${c.locations[0].state} · ${c.firmCount} ${c.firmCount === 1 ? 'firm' : 'firms'}`;
        tooltip.textContent = label;
        tooltip.style.display = 'block';
        const rect = mapContainer.getBoundingClientRect();
        tooltip.style.left = (event.clientX - rect.left) + 'px';
        tooltip.style.top = (event.clientY - rect.top) + 'px';
      });
      g.on('mousemove', (event) => {
        const rect = mapContainer.getBoundingClientRect();
        tooltip.style.left = (event.clientX - rect.left) + 'px';
        tooltip.style.top = (event.clientY - rect.top) + 'px';
      });
      g.on('mouseleave', () => {
        g.select('circle').attr('fill', '#cf4420');
        tooltip.style.display = 'none';
      });

      g.on('click', (event) => {
        event.stopPropagation();
        tooltip.style.display = 'none';
        if (!isCluster) {
          showPanel(c.locations[0]);
        } else {
          const newScale = Math.min(scale * 2.3, 30);
          if (newScale >= 30 && scale >= 30) {
            showMergedPanel(c);
          } else {
            const tx = 480 - c.cx * newScale;
            const ty = 300 - c.cy * newScale;
            svg.transition().duration(450).call(
              zoom.transform,
              d3.zoomIdentity.translate(tx, ty).scale(newScale)
            );
          }
        }
      });
    });
  }

  function renderCityMarkers(scale) {
    const cityG = d3.select('#cities');
    const opacity = scale > 4 ? Math.min(1, (scale - 4) / 3) : 0;
    if (opacity === 0) { cityG.selectAll('*').attr('opacity', 0); return; }

    const sel = cityG.selectAll('g.city-pt').data(locPoints, d => d.loc.city + d.loc.state);
    const enter = sel.enter().append('g').attr('class', 'city-pt');
    enter.append('circle').attr('class', 'city-marker').attr('r', 1.2);
    enter.append('text').attr('class', 'city-label').attr('dx', 3).attr('dy', -3);

    const all = enter.merge(sel);
    all.attr('transform', d => `translate(${d.x},${d.y})`);
    all.select('circle').attr('r', 1.5 / Math.sqrt(scale)).attr('opacity', opacity);
    all.select('text')
      .text(d => d.loc.city)
      .attr('font-size', 8 / Math.sqrt(scale))
      .attr('dx', 3 / scale).attr('dy', -3 / scale)
      .attr('opacity', opacity);
  }

  const zoom = d3.zoom()
    .scaleExtent([1, 30])
    .translateExtent([[0, 0], [960, 600]])
    .on('zoom', (event) => {
      const t = event.transform;
      zoomGroup.attr('transform', t);
      const k = t.k;
      zoomGroup.selectAll('.state-path').attr('stroke-width', 0.5 / k);
      const countyOpacity = k > 3 ? Math.min(1, (k - 3) / 3) : 0;
      zoomGroup.selectAll('.county-path').attr('opacity', countyOpacity).attr('stroke-width', 0.3 / k);
      renderClusters(k);
      renderCityMarkers(k);
    });

  svg.call(zoom);
  document.getElementById('zoom-in').addEventListener('click', () => svg.transition().duration(300).call(zoom.scaleBy, 1.6));
  document.getElementById('zoom-out').addEventListener('click', () => svg.transition().duration(300).call(zoom.scaleBy, 1 / 1.6));
  document.getElementById('zoom-reset').addEventListener('click', () => svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity));

  d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json').then(us => {
    d3.select('#states').selectAll('path')
      .data(topojson.feature(us, us.objects.states).features)
      .enter().append('path').attr('class', 'state-path').attr('d', path);
    d3.select('#counties').selectAll('path')
      .data(topojson.feature(us, us.objects.counties).features)
      .enter().append('path').attr('class', 'county-path').attr('d', path);
    renderClusters(1);
    renderCityMarkers(1);
  });
})();
