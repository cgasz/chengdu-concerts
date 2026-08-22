/* ===== 成都演唱会工作台 · 主应用 ===== */
'use strict';
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DATA = { concerts: [], venues: [], announcements: [], guides: null, site: null };
const VENUE_MAP = () => Object.fromEntries(DATA.venues.map((v) => [v.id, v]));

/* ---------- 导航 ---------- */
const NAV = [
  ['🎤', '演唱会列表', 'concerts', '全部演出卡片'],
  ['📅', '演出日历', 'calendar', '按日期看演出'],
  ['⏰', '开票倒计时', 'countdown', '别错过抢票'],
  ['🏟️', '场馆速览', 'venues', '场馆地址交通'],
  ['🎪', '音乐节专题', 'festivals', '音乐节汇总'],
  ['⭐', '艺人追踪', 'artists', '关注艺人置顶'],
  ['🎫', '购票渠道', 'tickets', '官方购票入口'],
  ['💡', '抢票攻略', 'guide', '实名·技巧·防骗'],
  ['📢', '动态公告', 'announcements', '官宣·开票·变动'],
  ['🗂️', '历史回顾', 'history', '已结束演出'],
  ['🔍', '数据来源', 'sources', '核验与更新说明']
];

/* ---------- 收藏（本地存储） ---------- */
const FAV_KEY = 'cd-favs';
const getFavs = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch (e) { return []; } };
const saveFavs = (a) => { try { localStorage.setItem(FAV_KEY, JSON.stringify(a)); } catch (e) {} };
const isFav = (artist) => getFavs().includes(artist);
const toggleFav = (artist) => {
  const f = getFavs();
  const i = f.indexOf(artist);
  if (i >= 0) f.splice(i, 1); else f.push(artist);
  saveFavs(f);
  return i < 0;
};

/* ---------- 工具 ---------- */
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const parseIso = (s) => { const p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
const wdOf = (s) => '周' + WEEK[parseIso(s).getDay()];
const pretty = (s) => { const p = s.split('-'); return (+p[1]) + '月' + (+p[2]) + '日'; };
const prettyFull = (s) => pretty(s) + ' ' + wdOf(s);
const dateRange = (c) => {
  if (c.dates.length === 1) return prettyFull(c.dates[0]);
  const a = c.dates[0].split('-'), b = c.dates[c.dates.length - 1].split('-');
  if (a[0] === b[0] && a[1] === b[1]) return (+a[1]) + '月' + (+a[2]) + '日—' + (+b[2]) + '日（' + c.dates.length + '场）';
  return (+a[1]) + '月' + (+a[2]) + '日—' + (+b[1]) + '月' + (+b[2]) + '日（' + c.dates.length + '场）';
};
const countdown = (target) => {
  const diff = new Date(target) - new Date();
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000);
  return d > 0 ? d + '天' + h + '小时' : (h > 0 ? h + '小时' + m + '分' : m + '分钟');
};
const statusOf = (c) => {
  const now = new Date();
  const today = iso(now);
  const first = c.dates[0], last = c.dates[c.dates.length - 1];
  if (last < today) return { key: 'past', label: '已结束', cls: 'badge-info' };
  if (today >= first && today <= last) return { key: 'today', label: '🔥 今日开演', cls: 'badge-danger' };
  if (c.onSaleAt) {
    if (now < new Date(c.onSaleAt)) return { key: 'pending', label: '未开票', cls: 'badge-warn' };
    return { key: 'onsale', label: '已开票·售票中', cls: 'badge-ok' };
  }
  return { key: 'announced', label: '已官宣·待开票', cls: 'badge-primary' };
};
const buyLink = (platform, artist) => {
  const kw = encodeURIComponent(artist + ' 成都');
  switch (platform) {
    case '大麦': return 'https://search.damai.cn/search.html?keyword=' + kw;
    case '猫眼': return 'https://www.maoyan.com/concert';
    case '秀动': return 'https://www.showstart.com';
    case '票星球': return 'https://www.ticketplanet.cn';
    case '纷玩岛': return 'https://www.fenwandao.com';
    case '抖音生活服务': return 'https://www.douyin.com/search/' + kw;
    case '携程': return 'https://piao.ctrip.com';
    case '飞猪': return 'https://www.fliggy.com';
    default: return null;
  }
};
const buyButtons = (c) => (c.buyPlatforms || []).map((p) => {
  const u = buyLink(p, c.artist);
  return u ? '<a class="btn btn-sm" href="' + u + '" target="_blank" rel="noopener">🎫 ' + esc(p) + '</a>' : '<span class="chip">🎫 ' + esc(p) + '</span>';
}).join('');
const starHtml = (artist) => '<button class="star' + (isFav(artist) ? ' on' : '') + '" data-fav="' + esc(artist) + '" title="关注/取消关注">' + (isFav(artist) ? '⭐' : '☆') + '</button>';
const srcLinks = (c) => (c.sources || []).map((s) => '<div class="src-link">📎 <a href="' + s.url + '" target="_blank" rel="noopener">' + esc(s.name) + '</a></div>').join('');

const venueName = (id) => { const v = VENUE_MAP()[id]; return v ? v.name : id; };

/* ---------- 卡片 ---------- */
const concertCard = (c) => {
  const st = statusOf(c);
  const fav = isFav(c.artist);
  return '<div class="card ccard' + (fav ? ' fav' : '') + '" data-id="' + c.id + '">' +
    '<div class="card-head">' +
      '<span class="card-ico">' + c.icon + '</span>' +
      '<div class="card-title"><a href="#/concert/' + c.id + '">' + esc(c.artist) + ' ' + esc(c.title) + '</a>' + starHtml(c.artist) + '</div>' +
      '<span class="badge ' + st.cls + '">' + st.label + '</span>' +
    '</div>' +
    '<div class="meta">' +
      '<span>📅 ' + dateRange(c) + '</span>' +
      '<span>🏟️ ' + esc(venueName(c.venueId)) + '</span>' +
      '<span>💰 <span class="price-hl">' + esc(c.priceRange) + '</span></span>' +
    '</div>' +
    (c.category === 'festival' && c.note ? '<div class="card-desc">🎪 ' + esc(c.note) + '</div>' : '') +
    '<div class="actions"><a class="btn btn-sm btn-primary" href="#/concert/' + c.id + '">📄 详情</a>' + buyButtons(c) + '</div>' +
  '</div>';
};

/* ---------- 页面渲染 ---------- */
const view = $('#view');

function renderConcerts() {
  const today = iso(new Date());
  let list = DATA.concerts.filter((c) => c.dates[c.dates.length - 1] >= today && c.category === 'concert');
  const artists = [...new Set(list.map((c) => c.artist))].sort();
  const venues = [...new Set(list.map((c) => c.venueId))];
  const months = [...new Set(list.flatMap((c) => c.dates.map((d) => d.slice(0, 7))))].sort();
  const f = getFavs();
  const html = '<div class="page-head"><h1>🎤 演唱会列表</h1><div class="page-sub">共 ' + list.length + ' 场已官宣演出（成都）· 数据逐条核实 · 关注 ⭐ 的艺人置顶</div></div>' +
    '<div class="filters">' +
      '<select id="f-artist"><option value="">🎤 全部艺人</option>' + artists.map((a) => '<option>' + esc(a) + '</option>').join('') + '</select>' +
      '<select id="f-venue"><option value="">🏟️ 全部场馆</option>' + venues.map((v) => '<option value="' + v + '">' + esc(venueName(v)) + '</option>').join('') + '</select>' +
      '<select id="f-month"><option value="">📅 全部月份</option>' + months.map((m) => '<option value="' + m + '">' + m.replace('-', '年') + '月</option>').join('') + '</select>' +
      '<label class="chip" style="display:inline-flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" id="f-fav" style="accent-color:#E8543F"> ⭐ 只看关注</label>' +
    '</div><div class="grid" id="concerts-grid"></div>';
  view.innerHTML = html;
  const grid = $('#concerts-grid');
  const render = () => {
    const fa = $('#f-artist').value, fv = $('#f-venue').value, fm = $('#f-month').value, ff = $('#f-fav').checked;
    let rows = list.filter((c) =>
      (!fa || c.artist === fa) && (!fv || c.venueId === fv) && (!fm || c.dates.some((d) => d.startsWith(fm))) && (!ff || isFav(c.artist))
    ).sort((a, b) => (a.dates[0] < b.dates[0] ? -1 : 1))
     .sort((a, b) => (isFav(b.artist) - isFav(a.artist)));
    grid.innerHTML = rows.length ? rows.map(concertCard).join('') : '<div class="empty">😶 没有符合条件的演出，换个筛选试试</div>';
    bindFav();
  };
  ['f-artist', 'f-venue', 'f-month', 'f-fav'].forEach((id) => $('#' + id).addEventListener('change', render));
  render();
}

function renderCalendar() {
  const today = iso(new Date());
  const days = {};
  DATA.concerts.forEach((c) => c.dates.forEach((d) => {
    if (d < today) return;
    (days[d] = days[d] || []).push(c);
  }));
  const sorted = Object.keys(days).sort();
  let html = '<div class="page-head"><h1>📅 演出日历</h1><div class="page-sub">已官宣演出按日期排列 · 今日高亮（数据更新至 ' + DATA.site.updatedAt + '）</div></div>';
  let curMonth = '';
  sorted.forEach((d) => {
    const m = d.slice(0, 7);
    if (m !== curMonth) { curMonth = m; html += '<div class="cal-month">🗓️ ' + m.replace('-', '年') + '月</div>'; }
    days[d].sort((a, b) => (a.dates[0] < b.dates[0] ? -1 : 1)).forEach((c) => {
      html += '<div class="cal-day' + (d === today ? ' today' : '') + '">' +
        '<div class="cal-date"><div class="d">' + (+d.split('-')[2]) + '</div><div class="w">' + (+d.split('-')[1]) + '月 ' + wdOf(d) + '</div></div>' +
        '<div class="cal-info"><div class="t">' + c.icon + ' <a href="#/concert/' + c.id + '">' + esc(c.artist) + ' ' + esc(c.title) + '</a>' + (d === today ? ' <span class="badge badge-danger">今日</span>' : '') + '</div>' +
        '<div class="v">🏟️ ' + esc(venueName(c.venueId)) + ' · ⏰ ' + esc(c.startTime || '时间待定') + (c.dates.length > 1 ? ' · 共' + c.dates.length + '场' : '') + '</div></div></div>';
    });
  });
  if (!sorted.length) html += '<div class="empty">📭 暂无已官宣演出</div>';
  view.innerHTML = html + '<div class="foot-note">💡 提示：日历仅展示已官宣且未结束的演出；点击演出名可查看详情与购票链接。</div>';
}

function renderCountdown() {
  const now = new Date();
  const upcoming = DATA.concerts.filter((c) => c.dates[0] >= iso(now));
  const pending = upcoming.filter((c) => c.onSaleAt && now < new Date(c.onSaleAt)).sort((a, b) => (a.onSaleAt < b.onSaleAt ? -1 : 1));
  const soon = upcoming.filter((c) => !(c.onSaleAt && now < new Date(c.onSaleAt))).sort((a, b) => (a.dates[0] < b.dates[0] ? -1 : 1)).slice(0, 12);
  let html = '<div class="page-head"><h1>⏰ 开票倒计时</h1><div class="page-sub">未开票演出按开票时间升序，避免错过抢票</div></div>';
  html += '<div class="sec-title">🎯 即将开票</div>';
  if (pending.length) {
    html += '<div class="grid">' + pending.map((c) => {
      const cd = countdown(c.onSaleAt);
      return '<div class="card"><div class="card-head"><span class="card-ico">' + c.icon + '</span><div class="card-title"><a href="#/concert/' + c.id + '">' + esc(c.artist) + ' ' + esc(c.title) + '</a></div></div>' +
        '<div class="meta"><span>📅 ' + dateRange(c) + '</span><span>🏟️ ' + esc(venueName(c.venueId)) + '</span></div>' +
        '<div class="notice-ok notice" style="margin:0">🕒 距开票还有 <b style="font-size:18px">' + cd + '</b><br>📆 开票时间：' + prettyFull(c.onSaleAt.slice(0, 10)) + ' ' + c.onSaleAt.slice(11, 16) + '</div>' +
        '<div class="actions">' + buyButtons(c) + '</div></div>';
    }).join('') + '</div>';
  } else {
    html += '<div class="empty">🎉 当前没有未开票的已官宣演出，留意「动态公告」页的新官宣</div>';
  }
  html += '<div class="sec-title">🎤 即将开演</div><div class="grid">' +
    soon.map((c) => '<div class="card"><div class="card-head"><span class="card-ico">' + c.icon + '</span><div class="card-title"><a href="#/concert/' + c.id + '">' + esc(c.artist) + ' ' + esc(c.title) + '</a></div><span class="badge ' + statusOf(c).cls + '">' + statusOf(c).label + '</span></div>' +
      '<div class="meta"><span>📅 ' + dateRange(c) + '</span><span>🏟️ ' + esc(venueName(c.venueId)) + '</span><span>💰 <span class="price-hl">' + esc(c.priceRange) + '</span></span></div>' +
      '<div class="card-desc">⏳ 距开演 ' + (countdown(c.dates[0] + 'T' + (c.startTime || '19:00') + ':00') || '今日') + '</div>' +
      '<div class="actions"><a class="btn btn-sm btn-primary" href="#/concert/' + c.id + '">📄 详情</a>' + buyButtons(c) + '</div></div>').join('') + '</div>';
  view.innerHTML = html + '<div class="foot-note">💡 开票时间以票务平台官方为准；如已开票，请直接到对应平台查看余票。</div>';
}

function renderVenues() {
  const html = '<div class="page-head"><h1>🏟️ 场馆速览</h1><div class="page-sub">成都主要演出场馆：地址 · 交通 · 代表演出（共 ' + DATA.venues.length + ' 个）</div></div>' +
    '<div class="grid">' + DATA.venues.map((v) =>
      '<div class="card"><div class="card-head"><span class="card-ico">' + v.icon + '</span><div class="card-title">' + esc(v.name) + '</div></div>' +
      '<div class="card-desc">' + esc(v.desc) + '</div>' +
      '<div class="meta"><span>📍 ' + esc(v.address) + '</span><span>🚇 ' + esc(v.transport) + '</span></div>' +
      (v.events.length ? '<div class="meta"><span>🎤 代表演出：' + v.events.map((e) => '<span class="chip">' + esc(e) + '</span>').join(' ') + '</span></div>' : '') +
      (v.note ? '<div class="card-desc">📝 ' + esc(v.note) + '</div>' : '') + '</div>').join('') + '</div>' +
    '<div class="foot-note">📍 场馆地址与交通为常规信息，具体入场口、停车指引以每场演出的官方观演攻略为准。</div>';
  view.innerHTML = html;
}

function renderFestivals() {
  const fests = DATA.concerts.filter((c) => c.category === 'festival');
  let html = '<div class="page-head"><h1>🎪 音乐节专题</h1><div class="page-sub">成都及周边音乐节汇总 · 数据逐条核实</div></div>';
  html += '<div class="sec-title">🎪 即将举办</div><div class="grid">' +
    (fests.length ? fests.map((c) =>
      '<div class="card"><div class="card-head"><span class="card-ico">🎪</span><div class="card-title"><a href="#/concert/' + c.id + '">' + esc(c.title) + '</a></div><span class="badge ' + statusOf(c).cls + '">' + statusOf(c).label + '</span></div>' +
      '<div class="meta"><span>📅 ' + dateRange(c) + '</span><span>📍 ' + esc(venueName(c.venueId)) + '</span><span>💰 <span class="price-hl">' + esc(c.priceRange) + '</span></span></div>' +
      '<div class="card-desc">🎶 阵容：' + esc((c.note || '').split('。')[0]) + '</div>' +
      '<div class="actions">' + buyButtons(c) + '</div></div>').join('') : '<div class="empty">暂无已官宣音乐节</div>') + '</div>';
  html += '<div class="sec-title">🗂️ 已举办回顾</div><div class="grid">' +
    '<div class="card"><div class="card-head"><span class="card-ico">🍓</span><div class="card-title">2026成都草莓音乐节（喜力星银）</div><span class="badge badge-info">已举办</span></div>' +
    '<div class="card-desc">2026年5月在成都露天音乐公园举办，首日约2.8万乐迷到场。</div>' +
    '<div class="meta"><span>📍 成都露天音乐公园（金牛区）</span></div>' +
    '<div class="src-link">📎 <a href="https://www.chengdu.gov.cn/cdsrmzf/c174536/2026-05/11/content_d71b26690da0464ab77e2273fcc5b26e.shtml" target="_blank" rel="noopener">成都市人民政府网站·草莓音乐节信息</a></div></div>' +
    '<div class="card"><div class="card-head"><span class="card-ico">🎆</span><div class="card-title">2026年世博园第二届消夏音乐嘉年华</div><span class="badge badge-info">夏季系列</span></div>' +
    '<div class="card-desc">成都世博园夏季音乐嘉年华系列活动，详见官方公告。</div>' +
    '<div class="src-link">📎 <a href="https://www.chengdu.gov.cn/cdsrmzf/c174536/2026-06/30/content_5fc0518fb27d42d89428a18025fb16a7.shtml" target="_blank" rel="noopener">成都市人民政府网站</a></div></div></div>';
  html += '<div class="foot-note">🎪 音乐节天气/场次变动较多，出发前请以主办方官方公告为准。</div>';
  view.innerHTML = html;
}

function renderArtists() {
  const today = iso(new Date());
  const favs = getFavs();
  const artistList = [...new Set(DATA.concerts.map((c) => c.artist))].sort((a, b) => {
    const fa = favs.includes(a) ? 0 : 1, fb = favs.includes(b) ? 0 : 1;
    return fa - fb || a.localeCompare(b, 'zh');
  });
  const card = (artist) => {
    const shows = DATA.concerts.filter((c) => c.artist === artist);
    const upcoming = shows.filter((c) => c.dates[0] >= today);
    const icon = shows[0].icon;
    return '<div class="card"><div class="card-head"><span class="card-ico">' + icon + '</span><div class="card-title">' + esc(artist) + '</div>' + starHtml(artist) + '</div>' +
      '<div class="meta"><span>🎤 已官宣 ' + shows.length + ' 场' + (upcoming.length ? ' · 未来 ' + upcoming.length + ' 场' : '') + '</span></div>' +
      (upcoming.length ? '<div class="card-desc">📅 ' + upcoming.map((c) => '<a href="#/concert/' + c.id + '">' + dateRange(c) + '</a>').join('；') + '</div>' : '<div class="card-desc">当前无未结束场次</div>') +
      '</div>';
  };
  const favHtml = favs.filter((a) => artistList.includes(a)).map(card).join('');
  view.innerHTML = '<div class="page-head"><h1>⭐ 艺人追踪</h1><div class="page-sub">点卡片右上角 ☆/⭐ 关注艺人，关注的艺人在列表页置顶高亮（数据保存在本机浏览器）</div></div>' +
    (favHtml ? '<div class="sec-title">⭐ 已关注</div><div class="grid">' + favHtml + '</div>' : '') +
    '<div class="sec-title">🎤 全部艺人</div><div class="grid">' + artistList.map(card).join('') + '</div>';
  bindFav();
}

function renderTickets() {
  const g = DATA.guides;
  view.innerHTML = '<div class="page-head"><h1>🎫 购票渠道指南</h1><div class="page-sub">认准官方渠道 · 警惕黄牛与诈骗</div></div>' +
    '<div class="grid">' + g.channels.map((ch) =>
      '<div class="card"><div class="card-head"><span class="card-ico">' + ch.icon + '</span><div class="card-title">' + esc(ch.name) + '</div></div>' +
      '<div class="card-desc">' + esc(ch.desc) + '</div>' +
      (ch.note ? '<div class="card-desc">💡 ' + esc(ch.note) + '</div>' : '') +
      (ch.url ? '<div class="actions"><a class="btn btn-sm btn-primary" href="' + ch.url + '" target="_blank" rel="noopener">🔗 访问官网</a></div>' : '') + '</div>').join('') + '</div>' +
    '<div class="sec-title">🚨 防骗要点</div>' +
    '<div class="notice">⚠️ 勿信「内部票 / 代抢 / 保真票」；勿向个人账户私下转账；演唱会门票切勿轻信非官方渠道的加价转卖，谨防假票与诈骗。</div>' +
    '<div class="sec-title">💡 实用提示</div><div class="grid">' + g.tips.map((t) =>
      '<div class="card"><div class="card-head"><span class="card-ico">' + t.icon + '</span><div class="card-title">' + esc(t.title) + '</div></div><div class="card-desc">' + esc(t.body) + '</div></div>').join('') + '</div>';
}

function renderGuide() {
  const g = DATA.guides;
  view.innerHTML = '<div class="page-head"><h1>💡 抢票攻略</h1><div class="page-sub">依据票务平台公开规则整理 · 具体以各平台当期规则为准</div></div>' +
    '<div class="grid">' + g.tips.map((t, i) =>
      '<div class="card"><div class="card-head"><span class="card-ico">' + t.icon + '</span><div class="card-title">' + (i + 1) + '. ' + esc(t.title) + '</div></div><div class="card-desc">' + esc(t.body) + '</div></div>').join('') + '</div>' +
    '<div class="sec-title">📌 开票日历速记</div><div class="card"><div class="meta" style="flex-direction:column;align-items:flex-start;gap:6px">' +
    DATA.announcements.filter((a) => a.type === 'onsale').map((a) => '<span>🎫 <b>' + a.date + '</b> · ' + esc(a.title) + '</span>').join('') + '</div></div>' +
    '<div class="foot-note">💡 抢票前完成实名认证与观演人信息填写；强实名演出不支持非官方渠道转票，谨防上当。</div>';
}

function renderAnnouncements() {
  const T = { news: ['📰', '官宣', 'badge-primary'], onsale: ['🎫', '开票', 'badge-ok'], change: ['⚠️', '变动提示', 'badge-danger'], tip: ['💡', '提示', 'badge-info'] };
  const list = [...DATA.announcements].sort((a, b) => (a.date < b.date ? 1 : -1));
  view.innerHTML = '<div class="page-head"><h1>📢 动态公告</h1><div class="page-sub">官宣 · 开票 · 变动提示，按时间倒序</div></div>' +
    '<div class="grid" style="grid-template-columns:1fr">' + list.map((a) => {
      const t = T[a.type] || T.tip;
      return '<div class="card"><div class="card-head"><span class="card-ico">' + t[0] + '</span><div class="card-title">' + esc(a.title) + '</div><span class="badge ' + t[2] + '">' + t[1] + '</span></div>' +
        '<div class="card-desc">📆 ' + a.date + ' · ' + esc(a.body) + '</div>' +
        (a.source && a.source.url ? '<div class="src-link">📎 <a href="' + a.source.url + '" target="_blank" rel="noopener">' + esc(a.source.name) + '</a></div>' : '') + '</div>';
    }).join('') + '</div>';
}

function renderHistory() {
  const today = iso(new Date());
  const past = DATA.concerts.filter((c) => c.dates[c.dates.length - 1] < today).sort((a, b) => (a.dates[0] > b.dates[0] ? -1 : 1));
  view.innerHTML = '<div class="page-head"><h1>🗂️ 历史演出回顾</h1><div class="page-sub">已结束演出归档，了解场馆与热门程度</div></div>' +
    (past.length ? '<div class="grid">' + past.map(concertCard).join('') + '</div>' : '<div class="empty">📭 暂无已归档演出</div>') +
    '<div class="sec-title">🎪 音乐节回顾</div><div class="grid">' +
    '<div class="card"><div class="card-head"><span class="card-ico">🍓</span><div class="card-title">2026成都草莓音乐节（喜力星银）</div><span class="badge badge-info">2026年5月</span></div>' +
    '<div class="card-desc">成都露天音乐公园举办，首日约2.8万乐迷到场，是2026年成都大型户外音乐节。</div>' +
    '<div class="src-link">📎 <a href="https://www.thecover.cn/news/bf79%2BMJMAc6H90qSdq8Jkw==" target="_blank" rel="noopener">封面新闻现场报道</a></div></div></div>' +
    '<div class="foot-note">🗂️ 归档信息用于了解各场馆承载能力与演出热度，帮助规划下一次抢票。</div>';
}

function renderSources() {
  const s = DATA.site;
  const n = DATA.concerts.length;
  view.innerHTML = '<div class="page-head"><h1>🔍 数据与来源说明</h1><div class="page-sub">本工作台个人自用，数据可溯源、可核验</div></div>' +
    '<div class="notice notice-ok">✅ 数据更新至 <b>' + s.updatedAt + '</b> · 已收录 ' + n + ' 场演出（逐条联网核实）· 11 个场馆</div>' +
    '<div class="card" style="margin-bottom:14px"><h3 style="color:var(--muted);font-size:14px;margin-bottom:8px">🧭 核验方法</h3><div class="card-desc">' + esc(s.method) + '</div></div>' +
    '<div class="sec-title">📚 主要数据来源</div><div class="grid">' + s.sources.map((x) =>
      '<div class="card"><div class="card-head"><span class="card-ico">📎</span><div class="card-title">' + esc(x.name) + '</div></div>' +
      '<div class="actions"><a class="btn btn-sm" href="' + x.url + '" target="_blank" rel="noopener">🔗 打开来源</a></div></div>').join('') + '</div>' +
    '<div class="sec-title">🕵️ 待核实线索（未收录，核实后补入）</div>' +
    '<div class="grid" style="grid-template-columns:1fr">' + s.pending.map((p) =>
      '<div class="card"><div class="card-head"><span class="card-ico">⏳</span><div class="card-title">' + esc(p.name) + '</div><span class="badge badge-warn">待核实</span></div>' +
      '<div class="card-desc">' + esc(p.info) + '</div>' +
      (p.sourceUrl ? '<div class="src-link">📎 <a href="' + p.sourceUrl + '" target="_blank" rel="noopener">线索来源</a></div>' : '') + '</div>').join('') + '</div>' +
    '<div class="sec-title">⚠️ 免责声明</div><div class="notice">' + esc(s.disclaimer) + '</div>';
}

function renderDetail(id) {
  const c = DATA.concerts.find((x) => x.id === id);
  if (!c) { view.innerHTML = '<div class="empty">😵 未找到该演出 <a href="#/concerts">← 返回列表</a></div>'; return; }
  const st = statusOf(c);
  const v = VENUE_MAP()[c.venueId];
  const onSale = c.onSaleAt ? prettyFull(c.onSaleAt.slice(0, 10)) + ' ' + c.onSaleAt.slice(11, 16) : '待官方公布';
  view.innerHTML = '<div class="detail-hero">' +
    '<div style="display:flex;align-items:center;gap:10px">' + starHtml(c.artist) + '<a class="btn btn-sm" href="#/concerts">← 返回列表</a></div>' +
    '<h1>' + c.icon + ' ' + esc(c.artist) + ' ' + esc(c.title) + '</h1>' +
    '<div class="sub">' + esc(c.category === 'festival' ? '🎪 音乐节' : '🎤 演唱会') + ' · ' + esc(c.note || '') + '</div>' +
    '<div style="margin-top:10px"><span class="badge ' + st.cls + '">' + st.label + '</span> ' +
    '<span class="badge badge-ok">✅ 已核实</span></div>' +
    '<div class="detail-grid">' +
      '<div class="detail-box"><h3>📅 演出场次</h3><div class="val">' + dateRange(c) + '</div><div class="card-desc">⏰ 开演 ' + esc(c.startTime || '待定') + (c.dates.length > 1 ? ' · 共' + c.dates.length + '场' : '') + '</div></div>' +
      '<div class="detail-box"><h3>🏟️ 演出场馆</h3><div class="val">' + esc(venueName(c.venueId)) + '</div>' + (v ? '<div class="card-desc">📍 ' + esc(v.address) + '</div>' : '') + '</div>' +
      '<div class="detail-box"><h3>💰 票价档位</h3><div class="val price-hl">' + esc(c.priceRange) + '</div></div>' +
      '<div class="detail-box"><h3>🎫 开票时间</h3><div class="val">' + (c.onSaleAt ? (st.key === 'pending' ? '⏳ ' + onSale + '（倒计时 ' + countdown(c.onSaleAt) + '）' : onSale) : '待官方公布') + '</div></div>' +
    '</div></div>' +
    (c.buyPlatforms.length ? '<div class="sec-title">🎫 官方购票渠道</div><div class="card"><div class="meta" style="flex-direction:column;align-items:flex-start;gap:10px">' +
      c.buyPlatforms.map((p) => { const u = buyLink(p, c.artist); return '<span>' + (u ? '<a class="btn btn-sm btn-primary" href="' + u + '" target="_blank" rel="noopener">🎫 ' + esc(p) + '（搜「' + esc(c.artist) + ' 成都」）</a>' : '🎫 ' + esc(p)) + '</span>'; }).join('') +
      '</div><div class="card-desc" style="margin-top:8px">🚨 仅认准官方渠道购票，切勿私下转账或购买黄牛票。</div></div>' : '') +
    '<div class="sec-title">📎 信息来源（逐条核实）</div><div class="card">' + srcLinks(c) + '</div>' +
    (v ? '<div class="sec-title">🚇 场馆交通</div><div class="card"><div class="meta"><span>📍 ' + esc(v.address) + '</span></div><div class="card-desc">🚇 ' + esc(v.transport) + '</div></div>' : '') +
    '<div class="foot-note">⚠️ 演出信息以票务平台与主办方官方最新公告为准；如官方调整场次/票价/时间，本页将随工作台数据更新。</div>';
  bindFav();
}

/* ---------- 绑定收藏按钮 ---------- */
function bindFav() {
  $$('.star').forEach((btn) => btn.addEventListener('click', (e) => {
    e.preventDefault(); e.stopPropagation();
    const artist = btn.dataset.fav;
    toggleFav(artist);
    btn.textContent = isFav(artist) ? '⭐' : '☆';
    btn.classList.toggle('on', isFav(artist));
    const h = location.hash.replace('#/', '');
    if (h.startsWith('concerts')) renderConcerts();
    else if (h.startsWith('artists')) renderArtists();
    else if (h.startsWith('concert')) renderDetail(h.split('/')[1]);
  }));
}

/* ---------- 路由 ---------- */
function router() {
  let h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/');
  const route = parts[0] || 'concerts';
  const navMap = Object.fromEntries(NAV.map((n) => [n[2], n]));
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === route));
  window.scrollTo(0, 0);
  const pg = {
    concerts: renderConcerts, calendar: renderCalendar, countdown: renderCountdown,
    venues: renderVenues, festivals: renderFestivals, artists: renderArtists,
    tickets: renderTickets, guide: renderGuide, announcements: renderAnnouncements,
    history: renderHistory, sources: renderSources
  };
  if (route === 'concert' && parts[1]) return renderDetail(parts[1]);
  if (pg[route]) return pg[route]();
  view.innerHTML = '<div class="empty">😵 页面不存在 <a href="#/concerts">← 返回首页</a></div>';
}

/* ---------- 数据加载与自动更新 ---------- */
async function loadData() {
  const [c, v, a, g, s] = await Promise.all([
    fetch('data/concerts.json?t=' + Date.now()).then((r) => r.json()),
    fetch('data/venues.json?t=' + Date.now()).then((r) => r.json()),
    fetch('data/announcements.json?t=' + Date.now()).then((r) => r.json()),
    fetch('data/guides.json?t=' + Date.now()).then((r) => r.json()),
    fetch('data/site.json?t=' + Date.now()).then((r) => r.json())
  ]);
  return { concerts: c.concerts, venues: v.venues, announcements: a.announcements, guides: g, site: s };
}
const dataSnapshot = () => JSON.stringify([DATA.concerts, DATA.announcements, DATA.site && DATA.site.updatedAt]);
let _snap = '';
let _checking = false;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3500);
}
async function checkForUpdates() {
  if (_checking) return;
  _checking = true;
  try {
    const fresh = await loadData();
    const snap = JSON.stringify([fresh.concerts, fresh.announcements, fresh.site && fresh.site.updatedAt]);
    if (snap !== _snap) {
      DATA.concerts = fresh.concerts; DATA.venues = fresh.venues; DATA.announcements = fresh.announcements; DATA.guides = fresh.guides; DATA.site = fresh.site;
      _snap = snap;
      $('#side-updated').textContent = fresh.site.updatedAt;
      toast('🆕 数据已自动更新（' + fresh.site.updatedAt + '）');
      router();
    }
  } catch (e) { /* 网络异常时静默跳过，下轮再试 */ } finally { _checking = false; }
}
function startAutoRefresh() { setInterval(checkForUpdates, 10 * 60 * 1000); }

/* ---------- 启动 ---------- */
async function boot() {
  $('#nav').innerHTML = NAV.map((n) =>
    '<a href="#/' + n[2] + '" data-route="' + n[2] + '" title="' + n[3] + '"><span class="nav-ico">' + n[0] + '</span><span class="nav-lbl">' + n[1] + '</span></a>').join('');
  try {
    const fresh = await loadData();
    DATA.concerts = fresh.concerts; DATA.venues = fresh.venues; DATA.announcements = fresh.announcements; DATA.guides = fresh.guides; DATA.site = fresh.site;
    _snap = dataSnapshot();
    $('#side-updated').textContent = fresh.site.updatedAt;
    document.title = '成都演唱会工作台 · 更新至 ' + fresh.site.updatedAt;
  } catch (e) {
    view.innerHTML = '<div class="empty">😵 数据加载失败，请检查网络后刷新。<br><span style="font-size:12px">' + esc(e.message) + '</span></div>';
    return;
  }
  window.addEventListener('hashchange', router);
  router();
  startAutoRefresh();
  if ('serviceWorker' in navigator) {
    try { navigator.serviceWorker.register('sw.js'); } catch (e) {}
  }
}
boot();
