const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

// 找到阅读界面的起始和结束位置
const startMarker = '<!-- =========================================================================\n       ARTICLE READER DRAWER';
const endMarker = '<!-- =========================================================================\n       COMPOSE NEW POST MODAL';

const startIdx = html.indexOf(startMarker);
const endIdx = html.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.log('✗ 未找到阅读界面标记');
  process.exit(1);
}

// 新的阅读界面 HTML
const newReaderHTML = `<!-- =========================================================================
       ARTICLE READER DRAWER / MODAL (重新设计的阅读界面)
       ========================================================================= -->
  <div id="articleModal" class="fixed inset-0 z-40 hidden bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-0 sm:p-4">
    <!-- 背景几何装饰 -->
    <div class="absolute inset-0 pointer-events-none overflow-hidden opacity-15">
      <svg class="absolute top-10 right-10 w-64 h-64 text-cyan-400/30 animate-[spin_30s_linear_infinite]" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="0.5" stroke-dasharray="5,5"/>
        <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" stroke-width="0.5"/>
      </svg>
      <svg class="absolute bottom-20 left-10 w-48 h-48 text-pink-400/30 animate-[spin_25s_linear_infinite_reverse]" viewBox="0 0 100 100">
        <polygon points="50,15 85,85 15,85" fill="none" stroke="currentColor" stroke-width="0.5"/>
      </svg>
    </div>

    <div class="ak-reader-container w-full h-full sm:h-auto sm:max-w-5xl sm:max-h-[92vh] flex flex-col border-0 sm:border-2 border-cyan-400/40 shadow-[0_0_60px_rgba(142,205,232,0.15)] overflow-hidden bg-[#0A0D12]/95 backdrop-blur-xl">
      <!-- 顶部进度条 -->
      <div class="w-full h-1 bg-slate-900/50 relative overflow-hidden">
        <div id="readingProgressBar" class="h-full bg-gradient-to-r from-cyan-400 via-[#F7A8B8] to-amber-300 w-0 transition-all duration-150 shadow-[0_0_20px_currentColor]"></div>
      </div>

      <!-- 顶部工具栏 -->
      <div class="px-4 sm:px-6 py-3 border-b border-cyan-500/20 flex items-center justify-between bg-gradient-to-b from-[#041016] to-[#0A0D12]">
        <div class="flex items-center gap-2 min-w-0">
          <span id="modalPostIdBadge" class="font-mono text-[10px] sm:text-xs font-bold px-2 py-1 bg-[#F7A8B8] text-[#05131A] shadow-lg">LAT-01</span>
          <span id="modalPostCatBadge" class="hidden sm:inline-block font-mono text-[10px] px-2 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">分类</span>
        </div>
        <div class="flex flex-wrap items-center gap-1">
          <button onclick="editCurrentArticle()" class="px-2 py-1 text-[10px] sm:text-xs font-mono bg-[#F7A8B8]/20 text-pink-200 border border-[#F7A8B8]/50 hover:bg-[#F7A8B8] hover:text-[#05131A] transition-all duration-200" title="编辑">✎</button>
          <button onclick="exportCurrentArticleMd()" class="px-2 py-1 text-[10px] sm:text-xs font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-400/40 hover:bg-cyan-400 hover:text-slate-950 transition-all duration-200" title="导出">.MD</button>
          <button onclick="deleteCurrentArticle()" class="px-2 py-1 text-[10px] sm:text-xs font-mono border border-rose-500/40 text-rose-300 hover:bg-rose-500 hover:text-white transition-all duration-200" title="删除">🗑</button>
          <button onclick="adjustFontSize(-1)" class="px-2 py-1 text-[10px] sm:text-xs font-mono border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition-all duration-200" title="缩小">A-</button>
          <button onclick="adjustFontSize(1)" class="px-2 py-1 text-[10px] sm:text-xs font-mono border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition-all duration-200" title="放大">A+</button>
          <button onclick="closeArticleModal()" class="px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-mono font-bold bg-[#F3EFE6] text-[#05131A] hover:bg-[#F7A8B8] transition-all duration-200">
            ✕ <span class="hidden sm:inline">ESC</span>
          </button>
        </div>
      </div>

      <!-- 主滚动区域 -->
      <div id="articleModalScroll" onscroll="updateReadingProgress()" class="flex-1 overflow-y-auto">
        <div class="max-w-3xl mx-auto px-6 sm:px-12 py-8 sm:py-16">

          <!-- 文章头部 -->
          <header class="space-y-6 pb-12 mb-12 border-b-2 border-cyan-500/20 relative">
            <!-- 装饰线条 -->
            <div class="absolute -left-4 top-0 bottom-0 w-1 bg-gradient-to-b from-[#F7A8B8] via-cyan-400 to-transparent opacity-60"></div>

            <div id="article-eyebrow" class="font-mono text-[9px] sm:text-[10px] tracking-[0.25em] text-[#F7A8B8]/80 uppercase">LATERANO EDITORIAL ARCHIVE</div>

            <h1 id="modalPostTitle" class="font-serif text-3xl sm:text-5xl lg:text-6xl font-black text-[#F3EFE6] leading-[1.1] tracking-tight">
              <!-- 标题将被 JS 填充 -->
            </h1>

            <div class="flex flex-wrap items-center gap-3 sm:gap-5 text-xs sm:text-sm font-mono text-slate-400/90 pt-2">
              <span id="modalPostDate" class="text-cyan-400/80"></span>
              <span class="text-slate-600">·</span>
              <span id="modalPostReadTime"></span>
              <span class="text-slate-600">·</span>
              <span class="text-cyan-400/70">👁 <span id="modalPostViews"></span> 次</span>
            </div>

            <div id="modalPostTags" class="flex flex-wrap gap-2 pt-2">
              <!-- 标签将被 JS 填充 -->
            </div>
          </header>

          <!-- 目录 (如果有) -->
          <div id="modalTocContainer" class="hidden mb-12 p-5 bg-gradient-to-br from-[#041016] to-[#0A0D12] border-l-4 border-[#8ECDE8] border border-cyan-500/20 shadow-lg">
            <div class="font-mono text-[10px] text-cyan-300 font-bold tracking-widest mb-3 flex items-center gap-2">
              <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"/></svg>
              TABLE OF CONTENTS
            </div>
            <div id="modalTocList" class="flex flex-wrap gap-2 text-xs font-mono"></div>
          </div>

          <!-- 正文内容 -->
          <article id="modalPostBody" class="ak-reader-prose space-y-7 text-slate-200/95 leading-[1.85] text-base sm:text-lg">
            <!-- 正文将被 JS 填充 -->
          </article>

          <!-- 上下篇导航 -->
          <nav id="modalPrevNextBar" class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-12 mt-12 border-t border-cyan-500/20">
            <!-- 导航按钮将被 JS 填充 -->
          </nav>

          <!-- 互动按钮区 -->
          <div class="mt-12 p-5 bg-gradient-to-br from-[#030D12] to-[#041016] border border-cyan-500/25 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div class="flex flex-wrap items-center gap-2.5">
              <button onclick="likeCurrentArticle()" id="modalLikeBtn" class="px-4 py-2.5 text-xs font-mono border border-cyan-400/50 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-400 hover:text-slate-950 transition-all duration-200 hover:scale-105">
                ▲ 共鸣 (<span id="modalLikeCount">0</span>)
              </button>
              <button onclick="bookmarkCurrentArticle()" id="modalBookmarkBtn" class="px-4 py-2.5 text-xs font-mono border border-pink-300/50 bg-pink-300/10 text-pink-200 hover:bg-[#F7A8B8] hover:text-[#05131A] transition-all duration-200 hover:scale-105">
                ☆ 收藏
              </button>
            </div>
            <button onclick="copyArticleShareLink()" class="px-4 py-2.5 text-xs font-mono text-slate-300 border border-slate-700 hover:border-cyan-400 transition-all duration-200">
              🔗 复制链接
            </button>
          </div>

          <!-- 评论区 -->
          <div class="mt-12 space-y-4">
            <h3 class="font-serif font-bold text-xl text-cyan-300 flex items-center gap-2">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clip-rule="evenodd"/></svg>
              评论
            </h3>
            <div class="flex gap-2">
              <input id="modalCommentInput" type="text" placeholder="发表你的看法..." class="flex-1 px-4 py-3 text-sm font-mono bg-slate-950/80 border border-cyan-500/40 text-white placeholder-slate-500 focus:outline-none focus:border-[#F7A8B8] focus:ring-1 focus:ring-[#F7A8B8]/50 transition-all" />
              <button onclick="addArticleComment()" class="px-5 py-3 text-sm font-mono font-bold bg-cyan-400 text-slate-950 hover:bg-cyan-300 transition-all duration-200 hover:scale-105">
                发送
              </button>
            </div>
            <div id="modalCommentsList" class="space-y-3 pt-2"></div>
          </div>

        </div>
      </div>
    </div>
  </div>

  `;

// 替换
html = html.substring(0, startIdx) + newReaderHTML + html.substring(endIdx);

fs.writeFileSync('public/index.html', html, 'utf8');
console.log('✓ 阅读界面 HTML 结构已更新');
