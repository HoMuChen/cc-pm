#!/usr/bin/env node
/**
 * 專案視覺化工具
 * 讀取 tasks.md 和 timeline.md，生成互動式 HTML 儀表板
 *
 * 使用方式: node scripts/visualize.js
 * 輸出: docs/dashboard.html
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const TASKS_FILE = path.join(ROOT_DIR, 'tasks.md');
const TIMELINE_FILE = path.join(ROOT_DIR, 'timeline.md');
const PROJECT_FILE = path.join(ROOT_DIR, 'project.yaml');
const OUTPUT_FILE = path.join(ROOT_DIR, 'docs', 'dashboard.html');

// 簡易 YAML frontmatter 解析器
function parseYamlFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yamlContent = match[1];
  return parseSimpleYaml(yamlContent);
}

// 簡易 YAML 解析（支援陣列和基本值）
function parseSimpleYaml(yaml) {
  const result = {};
  const lines = yaml.split('\n');
  let currentKey = null;
  let currentArray = null;
  let currentObject = null;
  let inArray = false;
  let arrayIndent = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 跳過註解和空行
    if (trimmed.startsWith('#') || trimmed === '') continue;

    // 檢測陣列項目
    if (trimmed.startsWith('- ')) {
      if (currentKey && (result[currentKey] === undefined || Array.isArray(result[currentKey]))) {
        if (!Array.isArray(result[currentKey])) {
          result[currentKey] = [];
        }

        // 檢查是否是物件陣列
        const itemContent = trimmed.substring(2);
        if (itemContent.includes(':')) {
          // 物件陣列項目
          const obj = {};
          const firstPair = itemContent.match(/^(\w+):\s*(.*)$/);
          if (firstPair) {
            obj[firstPair[1]] = parseValue(firstPair[2]);
          }

          // 讀取後續的物件屬性
          let j = i + 1;
          while (j < lines.length) {
            const nextLine = lines[j];
            const nextTrimmed = nextLine.trim();
            const indent = nextLine.search(/\S/);

            if (nextTrimmed === '' || nextTrimmed.startsWith('#')) {
              j++;
              continue;
            }

            // 如果縮排變小或遇到新的陣列項目，結束當前物件
            if (indent <= line.search(/\S/) || nextTrimmed.startsWith('- ')) {
              break;
            }

            const propMatch = nextTrimmed.match(/^(\w+):\s*(.*)$/);
            if (propMatch) {
              obj[propMatch[1]] = parseValue(propMatch[2]);
            }
            j++;
          }
          i = j - 1;
          result[currentKey].push(obj);
        } else {
          // 簡單值陣列
          result[currentKey].push(parseValue(itemContent));
        }
      }
    } else {
      // 鍵值對
      const match = trimmed.match(/^(\w+):\s*(.*)$/);
      if (match) {
        currentKey = match[1];
        const value = match[2];

        if (value === '' || value === '[]') {
          result[currentKey] = [];
        } else {
          result[currentKey] = parseValue(value);
        }
      }
    }
  }

  return result;
}

function parseValue(str) {
  str = str.trim();
  if (str === '' || str === 'null' || str === '~') return null;
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (str.startsWith('"') && str.endsWith('"')) return str.slice(1, -1);
  if (str.startsWith("'") && str.endsWith("'")) return str.slice(1, -1);
  if (str.startsWith('[') && str.endsWith(']')) {
    // 行內陣列
    const inner = str.slice(1, -1);
    if (inner === '') return [];
    return inner.split(',').map(s => parseValue(s.trim()));
  }
  if (!isNaN(str) && str !== '') return Number(str);
  return str;
}

// 解析 project.yaml
function parseProjectYaml(content) {
  const result = {
    project: {},
    stakeholders: {},
    scope: {}
  };

  const lines = content.split('\n');
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed === '') continue;

    if (line.match(/^project:/)) {
      currentSection = 'project';
      continue;
    } else if (line.match(/^stakeholders:/)) {
      currentSection = 'stakeholders';
      continue;
    } else if (line.match(/^scope:/)) {
      currentSection = 'scope';
      continue;
    } else if (line.match(/^notes:/)) {
      currentSection = null;
      const match = line.match(/^notes:\s*(.*)$/);
      if (match) result.notes = parseValue(match[1]);
      continue;
    }

    if (currentSection && line.startsWith('  ')) {
      const match = trimmed.match(/^(\w+):\s*(.*)$/);
      if (match) {
        result[currentSection][match[1]] = parseValue(match[2]);
      }
    }
  }

  return result;
}

// 讀取並解析檔案
function loadData() {
  const tasksContent = fs.readFileSync(TASKS_FILE, 'utf-8');
  const timelineContent = fs.readFileSync(TIMELINE_FILE, 'utf-8');
  const projectContent = fs.readFileSync(PROJECT_FILE, 'utf-8');

  const tasks = parseYamlFrontmatter(tasksContent).tasks || [];
  const milestones = parseYamlFrontmatter(timelineContent).milestones || [];
  const project = parseProjectYaml(projectContent);

  return { tasks, milestones, project };
}

// 生成 HTML
function generateHtml(data) {
  const { tasks, milestones, project } = data;
  const projectName = project.project?.name || '專案管理儀表板';
  const today = new Date().toISOString().split('T')[0];

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName} - 儀表板</title>
  <style>
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #21262d;
      --border-color: #30363d;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --accent-blue: #58a6ff;
      --accent-green: #3fb950;
      --accent-yellow: #d29922;
      --accent-red: #f85149;
      --accent-purple: #a371f7;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.5;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 24px;
    }

    header {
      margin-bottom: 32px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-color);
    }

    header h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .project-meta {
      display: flex;
      gap: 24px;
      color: var(--text-secondary);
      font-size: 14px;
    }

    .project-meta span {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0;
    }

    .tab {
      padding: 12px 16px;
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: 14px;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: all 0.2s;
    }

    .tab:hover {
      color: var(--text-primary);
    }

    .tab.active {
      color: var(--text-primary);
      border-bottom-color: var(--accent-blue);
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    /* Kanban Board */
    .kanban {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      overflow-x: auto;
    }

    .kanban-column {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 12px;
      min-width: 250px;
    }

    .column-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border-color);
    }

    .column-header h3 {
      font-size: 14px;
      font-weight: 600;
    }

    .column-count {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 10px;
    }

    .task-card {
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .task-card:hover {
      border-color: var(--accent-blue);
      transform: translateY(-1px);
    }

    .task-title {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .task-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 12px;
    }

    .priority {
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
    }

    .priority-p0 { background: rgba(248, 81, 73, 0.2); color: var(--accent-red); }
    .priority-p1 { background: rgba(210, 153, 34, 0.2); color: var(--accent-yellow); }
    .priority-p2 { background: rgba(63, 185, 80, 0.2); color: var(--accent-green); }

    .due-date {
      color: var(--text-secondary);
    }

    .due-date.overdue {
      color: var(--accent-red);
    }

    .assignee {
      color: var(--accent-blue);
    }

    .empty-state {
      color: var(--text-secondary);
      font-size: 13px;
      text-align: center;
      padding: 24px;
    }

    /* Timeline */
    .timeline-container {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 24px;
    }

    .timeline {
      position: relative;
      padding-left: 24px;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 6px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--border-color);
    }

    .timeline-item {
      position: relative;
      margin-bottom: 24px;
      padding-left: 24px;
    }

    .timeline-item::before {
      content: '';
      position: absolute;
      left: -21px;
      top: 4px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--bg-tertiary);
      border: 2px solid var(--accent-blue);
    }

    .timeline-item.achieved::before {
      background: var(--accent-green);
      border-color: var(--accent-green);
    }

    .timeline-item.overdue::before {
      background: var(--accent-red);
      border-color: var(--accent-red);
    }

    .timeline-date {
      font-size: 12px;
      color: var(--text-secondary);
      margin-bottom: 4px;
    }

    .timeline-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .timeline-tasks {
      font-size: 13px;
      color: var(--text-secondary);
    }

    /* Gantt Chart */
    .gantt-container {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 24px;
      overflow-x: auto;
      margin-top: 24px;
    }

    .gantt-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .gantt-header h3 {
      font-size: 16px;
      font-weight: 600;
    }

    .gantt-chart {
      min-width: 800px;
    }

    .gantt-row {
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      height: 36px;
    }

    .gantt-label {
      width: 200px;
      font-size: 13px;
      padding-right: 16px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .gantt-bars {
      flex: 1;
      height: 100%;
      background: var(--bg-tertiary);
      border-radius: 4px;
      position: relative;
    }

    .gantt-bar {
      position: absolute;
      height: 24px;
      top: 6px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      padding: 0 8px;
      font-size: 11px;
      color: white;
      white-space: nowrap;
      overflow: hidden;
    }

    .gantt-bar.backlog { background: var(--text-secondary); }
    .gantt-bar.in-progress { background: var(--accent-blue); }
    .gantt-bar.blocked { background: var(--accent-red); }
    .gantt-bar.review { background: var(--accent-yellow); }
    .gantt-bar.done { background: var(--accent-green); }
    .gantt-bar.milestone { background: var(--accent-purple); }

    .gantt-today {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--accent-red);
      z-index: 10;
    }

    .gantt-today::after {
      content: '今天';
      position: absolute;
      top: -20px;
      left: -12px;
      font-size: 10px;
      color: var(--accent-red);
    }

    /* Summary Stats */
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--bg-secondary);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }

    .stat-value {
      font-size: 32px;
      font-weight: 600;
      color: var(--accent-blue);
    }

    .stat-label {
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    .stat-card.warning .stat-value { color: var(--accent-yellow); }
    .stat-card.danger .stat-value { color: var(--accent-red); }
    .stat-card.success .stat-value { color: var(--accent-green); }

    /* Responsive */
    @media (max-width: 1024px) {
      .kanban {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 768px) {
      .kanban {
        grid-template-columns: 1fr;
      }

      .stats {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    /* Legend */
    .legend {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
      font-size: 12px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .legend-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>${projectName || '專案管理儀表板'}</h1>
      <div class="project-meta">
        ${project.project?.type ? `<span>類型: ${project.project.type}</span>` : ''}
        ${project.project?.status ? `<span>狀態: ${project.project.status}</span>` : ''}
        ${project.project?.start_date ? `<span>開始: ${project.project.start_date}</span>` : ''}
        ${project.project?.target_date ? `<span>預計完成: ${project.project.target_date}</span>` : ''}
        <span>更新時間: ${today}</span>
      </div>
    </header>

    <!-- Stats -->
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value">${tasks.length}</div>
        <div class="stat-label">總任務數</div>
      </div>
      <div class="stat-card success">
        <div class="stat-value">${tasks.filter(t => t.status === 'done').length}</div>
        <div class="stat-label">已完成</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${tasks.filter(t => t.status === 'in-progress').length}</div>
        <div class="stat-label">進行中</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-value">${tasks.filter(t => t.status === 'blocked').length}</div>
        <div class="stat-label">阻塞中</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-value">${tasks.filter(t => t.due && t.due < today && t.status !== 'done').length}</div>
        <div class="stat-label">已逾期</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab active" data-tab="kanban">看板</button>
      <button class="tab" data-tab="timeline">時間軸</button>
      <button class="tab" data-tab="gantt">甘特圖</button>
    </div>

    <!-- Kanban View -->
    <div id="kanban" class="tab-content active">
      <div class="kanban">
        ${generateKanbanColumn('backlog', '📋 待辦', tasks, today)}
        ${generateKanbanColumn('in-progress', '🔵 進行中', tasks, today)}
        ${generateKanbanColumn('blocked', '🔴 阻塞', tasks, today)}
        ${generateKanbanColumn('review', '🟡 審核中', tasks, today)}
        ${generateKanbanColumn('done', '✅ 完成', tasks, today)}
      </div>
    </div>

    <!-- Timeline View -->
    <div id="timeline" class="tab-content">
      <div class="timeline-container">
        <h3 style="margin-bottom: 24px; font-size: 16px;">里程碑時間軸</h3>
        ${generateTimeline(milestones, today)}
      </div>
    </div>

    <!-- Gantt View -->
    <div id="gantt" class="tab-content">
      <div class="gantt-container">
        <div class="gantt-header">
          <h3>甘特圖</h3>
        </div>
        <div class="legend">
          <div class="legend-item"><span class="legend-color" style="background: var(--text-secondary)"></span>待辦</div>
          <div class="legend-item"><span class="legend-color" style="background: var(--accent-blue)"></span>進行中</div>
          <div class="legend-item"><span class="legend-color" style="background: var(--accent-red)"></span>阻塞</div>
          <div class="legend-item"><span class="legend-color" style="background: var(--accent-yellow)"></span>審核中</div>
          <div class="legend-item"><span class="legend-color" style="background: var(--accent-green)"></span>完成</div>
          <div class="legend-item"><span class="legend-color" style="background: var(--accent-purple)"></span>里程碑</div>
        </div>
        ${generateGanttChart(tasks, milestones, today, project)}
      </div>
    </div>
  </div>

  <script>
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      });
    });
  </script>
</body>
</html>`;
}

function generateKanbanColumn(status, title, tasks, today) {
  const columnTasks = tasks.filter(t => t.status === status);

  const cards = columnTasks.length > 0
    ? columnTasks.map(task => {
        const isOverdue = task.due && task.due < today && task.status !== 'done';
        return `
          <div class="task-card">
            <div class="task-title">${task.title || '未命名任務'}</div>
            <div class="task-meta">
              ${task.priority ? `<span class="priority priority-${task.priority.toLowerCase()}">${task.priority}</span>` : ''}
              ${task.due ? `<span class="due-date ${isOverdue ? 'overdue' : ''}">${task.due}</span>` : ''}
              ${task.assignee ? `<span class="assignee">@${task.assignee}</span>` : ''}
            </div>
          </div>
        `;
      }).join('')
    : '<div class="empty-state">尚無任務</div>';

  return `
    <div class="kanban-column">
      <div class="column-header">
        <h3>${title}</h3>
        <span class="column-count">${columnTasks.length}</span>
      </div>
      ${cards}
    </div>
  `;
}

function generateTimeline(milestones, today) {
  if (!milestones || milestones.length === 0) {
    return '<div class="empty-state">尚未設定里程碑</div>';
  }

  const sorted = [...milestones].sort((a, b) => {
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due.localeCompare(b.due);
  });

  return `
    <div class="timeline">
      ${sorted.map(m => {
        const isAchieved = m.status === 'achieved';
        const isOverdue = m.due && m.due < today && !isAchieved;
        const statusClass = isAchieved ? 'achieved' : (isOverdue ? 'overdue' : '');

        return `
          <div class="timeline-item ${statusClass}">
            <div class="timeline-date">${m.due || '日期未定'}</div>
            <div class="timeline-title">${m.title || '未命名里程碑'}</div>
            ${m.tasks && m.tasks.length > 0 ? `<div class="timeline-tasks">關聯任務: ${m.tasks.join(', ')}</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function generateGanttChart(tasks, milestones, today, project) {
  // 計算日期範圍
  const allDates = [];

  if (project.project?.start_date) allDates.push(project.project.start_date);
  if (project.project?.target_date) allDates.push(project.project.target_date);

  tasks.forEach(t => {
    if (t.due) allDates.push(t.due);
    if (t.created) allDates.push(t.created);
  });

  milestones.forEach(m => {
    if (m.due) allDates.push(m.due);
  });

  if (allDates.length === 0) {
    return '<div class="empty-state">尚無任務或里程碑資料可顯示</div>';
  }

  const sortedDates = allDates.sort();
  const startDate = new Date(sortedDates[0]);
  const endDate = new Date(sortedDates[sortedDates.length - 1]);

  // 擴展範圍
  startDate.setDate(startDate.getDate() - 7);
  endDate.setDate(endDate.getDate() + 14);

  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const todayDate = new Date(today);
  const todayPosition = Math.max(0, Math.min(100, ((todayDate - startDate) / (endDate - startDate)) * 100));

  const rows = [];

  // 任務
  tasks.forEach(task => {
    if (!task.due) return;

    const taskDue = new Date(task.due);
    const taskStart = task.created ? new Date(task.created) : new Date(taskDue.getTime() - 7 * 24 * 60 * 60 * 1000);

    const left = Math.max(0, ((taskStart - startDate) / (endDate - startDate)) * 100);
    const width = Math.min(100 - left, ((taskDue - taskStart) / (endDate - startDate)) * 100);

    rows.push(`
      <div class="gantt-row">
        <div class="gantt-label" title="${task.title}">${task.title || '未命名'}</div>
        <div class="gantt-bars">
          <div class="gantt-bar ${task.status}" style="left: ${left}%; width: ${Math.max(width, 2)}%">
            ${task.priority || ''}
          </div>
        </div>
      </div>
    `);
  });

  // 里程碑
  milestones.forEach(m => {
    if (!m.due) return;

    const mDate = new Date(m.due);
    const left = ((mDate - startDate) / (endDate - startDate)) * 100;

    rows.push(`
      <div class="gantt-row">
        <div class="gantt-label" title="${m.title}">🎯 ${m.title || '未命名'}</div>
        <div class="gantt-bars">
          <div class="gantt-bar milestone" style="left: ${left}%; width: 2%"></div>
        </div>
      </div>
    `);
  });

  if (rows.length === 0) {
    return '<div class="empty-state">尚無有日期的任務或里程碑</div>';
  }

  return `
    <div class="gantt-chart" style="position: relative;">
      <div class="gantt-today" style="left: calc(200px + ${todayPosition}% * (100% - 200px) / 100)"></div>
      ${rows.join('')}
    </div>
  `;
}

// 主程式
function main() {
  try {
    console.log('讀取專案資料...');
    const data = loadData();

    console.log(`- 任務數量: ${data.tasks.length}`);
    console.log(`- 里程碑數量: ${data.milestones.length}`);

    console.log('生成 HTML...');
    const html = generateHtml(data);

    // 確保 docs 目錄存在
    const docsDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(docsDir)) {
      fs.mkdirSync(docsDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, html, 'utf-8');
    console.log(`✅ 儀表板已生成: ${OUTPUT_FILE}`);
    console.log('\n用瀏覽器開啟此檔案即可查看視覺化儀表板');

  } catch (error) {
    console.error('❌ 錯誤:', error.message);
    process.exit(1);
  }
}

main();
