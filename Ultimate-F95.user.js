// @name         Ultimate F95
// @namespace    https://github.com/balu100/Ultimate-F95
// @version      1.3.3 
// @description  Ultimate F95
// @author       balu100
// @match        https://f95zone.to/sam/latest_alpha/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=f95zone.to
// @license      GNU
// @grant        none
// @run-at       document-end
// @downloadURL  https://github.com/balu100/Ultimate-F95/raw/main/Ultimate-F95.user.js
// ==/UserScript==

(function () {
    'use strict';
    const pBodyInner = document.querySelector('.p-body-inner');

    if (pBodyInner) {
        // Get the device width (browser window width)
        const deviceWidth = window.innerWidth;

        // Calculate 95% of the device width
        const newWidth = deviceWidth * 0.95;

        // Modify the max-width property to 95% of the device width
        pBodyInner.style.maxWidth = newWidth + 'px';
        }
    // --- Constants and State Variables ---
    const windowWidth = screen.width;
    let currentPage = 1;
    let isLoading = false;
    let noMorePages = false;
    let currentFilters = '';
    let infiniteScrollInitialized = false;
    let itemsPerRow = 90;
    let siteOptions = { newTab: "true", version: "small", searchHighlight: "true" };

    const itemContainerSelector = 'div#latest-page_items-wrap_inner';
    const itemSelector = '.resource-tile';
    const originalPaginationSelector = '.sub-nav_paging';
    const AJAX_ENDPOINT_URL = 'https://f95zone.to/sam/latest_alpha/latest_data.php';

    // --- Helper Function Definitions ---
    const htmlEscape = (str) => {
        if (str === null || str === undefined) {
            return '';
        }
        let text = String(str);
        text = text.replace(/&/g, '&'); // Corrected
        text = text.replace(/</g, '<');  // Corrected
        text = text.replace(/>/g, '>');  // Corrected
        text = text.replace(/"/g, '"');// Corrected
        text = text.replace(/'/g, '&#39;');
        return text;
    };

    const highlightUnreadLinks = () => {
        try {
            const links = document.querySelectorAll('a:not(.resource-item_row-hover_outer > a)');
            for (const link of links) {
                const text = link.textContent.trim().toLowerCase();
                const buttonText = link.querySelector('.button-text');
                if (link.href.includes('/unread?new=1') || text === 'jump to new' || (buttonText && buttonText.textContent.trim().toLowerCase() === 'jump to new')) {
                    link.classList.add('highlight-unread');
                    if (buttonText) buttonText.classList.add('highlight-unread');
                }
            }
        } catch (e) {
            console.error("ERROR IN highlightUnreadLinks:", e);
        }
    };

    const getCurrentPageFromUrl = () => { const hash = window.location.hash; if (hash && hash.includes('page=')) { const match = hash.match(/page=(\d+)/); if (match && match[1]) return parseInt(match[1], 10); } return 1; };
    const getCurrentFiltersFromUrl = () => { const params = new URLSearchParams(); const hash = window.location.hash; if (hash && hash.length > 1 && hash !== '#/') { let rhP = hash.substring(1); if (rhP.startsWith('/')) rhP = rhP.substring(1); const ps = rhP.split('/'); let fc=0,fs=0; ps.forEach(p => { if (p.includes('=')) { const [k, v] = p.split('='); if (k && v && k !== 'page') { params.set(k, decodeURIComponent(v)); if (k === 'cat') fc=1; if (k === 'sort') fs=1;}}}); if (!fc && !params.has('cat')) params.set('cat', 'games'); if (!fs && !params.has('sort')) params.set('sort', 'date');} else { params.set('cat', 'games'); params.set('sort', 'date');} return params.toString(); };

    function createItemElement(itemData_g) {
    const tile = document.createElement('div');
    // 1. Base classes (CRITICAL - Must match what latest.min.js finds/expects)
    let tileBaseClasses = ['resource-tile', 'userscript-generated-tile'];
    if (itemData_g.ignored) tileBaseClasses.push('resource-tile_ignored');
    if (itemData_g.new) tileBaseClasses.push('resource-tile_new');
    else tileBaseClasses.push('resource-tile_update');

    const currentCategoryFromFilters = (new URLSearchParams(currentFilters)).get('cat') || 'games';
    // The site's own code adds category-specific classes to the main tile element.
    // Example from their code: m.removeClass("resource-wrap-game resource-wrap-animation resource-wrap-comic resource-wrap-asset").addClass(e); (where e is derived from category)
    // The tiles themselves also get classes like 'game-item', 'comic-item' etc. from other parts of their logic.
    // We should try to add the most common ones if we can determine them.
    // For now, it's often added to the item container (`m`), not individual tiles by this specific loop.
    // However, inspect a live tile to see if it has, e.g., `game-item` or `resource-tile_game`
    if (currentCategoryFromFilters) {
        // tileBaseClasses.push(`${currentCategoryFromFilters}-item`); // Example
        // tileBaseClasses.push(`resource-tile_${currentCategoryFromFilters}`); // Example
    }
    // The class `grid-item` is often added by grid/masonry libraries AFTER DOM insertion.
    // XF.activate might handle this, or latest.min.js itself.

    tile.className = tileBaseClasses.join(' ');

    // 2. Data attributes
    tile.dataset.threadId = String(itemData_g.thread_id || '0');
    tile.dataset.tags = (itemData_g.tags && itemData_g.tags.length) ? itemData_g.tags.join(',') : '';
    tile.dataset.images = (itemData_g.screens && itemData_g.screens.length > 0) ? itemData_g.screens.join(',') : (itemData_g.cover || '');
    // Add any other data-xf-init, data-xf-click attributes seen on live tiles

    // 3. Inner HTML
    let threadLinkUrl = `https://f95zone.to/threads/${htmlEscape(String(itemData_g.thread_id || '0'))}/`;
    let titleTextForDisplay = htmlEscape(itemData_g.title || 'No Title');
    let titleTextForAttr = htmlEscape(itemData_g.title || 'No Title'); // Use htmlEscape for attributes too
    let rawCreatorText = itemData_g.creator || 'Unknown Creator';
    let versionText = (itemData_g.version && itemData_g.version !== "Unknown") ? htmlEscape(itemData_g.version) : "";
    let coverUrl = htmlEscape(itemData_g.cover || '');
    let views = itemData_g.views || 0;
    let likes = itemData_g.likes || 0;
    let ratingVal = itemData_g.rating !== undefined ? Number(itemData_g.rating) : 0;
    let ratingDisplay = ratingVal === 0 ? "-" : ratingVal.toFixed(1);
    let ratingWidth = 20 * ratingVal;
    let dateHtmlForDisplay = htmlEscape(itemData_g.date || 'N/A');
    const dateMatch = String(itemData_g.date).match(/^([0-9]+ )?([A-Za-z ]+)$/i);
    if (dateMatch) { dateHtmlForDisplay = `<span class="tile-date_${htmlEscape(dateMatch[2]).toLowerCase().replace(/ /g, "")}">${dateMatch[1] ? htmlEscape(dateMatch[1].trim()) : ""}</span>`; }
    let viewsFormatted = String(views);
    if (views > 1000000) viewsFormatted = (views / 1000000).toFixed(1) + "M";
    else if (views > 1000) viewsFormatted = Math.round(views / 1000) + "K";

    const newTabSetting = (siteOptions.newTab === "true");
    const versionStyleSmall = (siteOptions.version === "small"); // From k.version in latest.min.js

    // This is the critical part. Make it match the site's generated tile HTML exactly.
    // The structure below is based on the latest.min.js snippet.
    tile.innerHTML = `
        <a href="${threadLinkUrl}" class="resource-tile_link" rel="noopener"${newTabSetting ? ' target="_blank"' : ''}>
            <div class="resource-tile_thumb-wrap">
                <div class="resource-tile_thumb" style="background-image:url(${coverUrl ? `'${coverUrl}'` : 'none'})">
                    ${itemData_g.watched ? '<i class="far fa-eye watch-icon"></i>' : ''}
                </div>
            </div>
            <div class="resource-tile_body">
                <div class="resource-tile_label-wrap">
                    <div class="resource-tile_label-wrap_left">
                        <!-- Prefixes (non-status) are built by site's ra() and M variable logic -->
                    </div>
                    <div class="resource-tile_label-wrap_right">
                        <!-- Status Prefixes are also built by site's ra() -->
                        <div class="resource-tile_label-version">${(currentCategoryFromFilters !== "assets" && versionText && versionStyleSmall) ? versionText : ""}</div>
                    </div>
                </div>
                <div class="resource-tile_info">
                    <header class="resource-tile_info-header">
                        <div class="header_title-wrap">
                            <h2 class="resource-tile_info-header_title">${titleTextForDisplay}</h2>
                        </div>
                        <div class="header_title-ver">${(currentCategoryFromFilters !== "assets" && versionText && !versionStyleSmall) ? versionText : ""}</div>
                        <div class="resource-tile_dev fas fa-user">${(currentCategoryFromFilters !== "assets") ? ` ${htmlEscape(rawCreatorText)}` : ""}</div>
                    </header>
                    <div class="resource-tile_info-meta">
                        <div class="resource-tile_info-meta_time">${dateHtmlForDisplay}</div>
                        <div class="resource-tile_info-meta_likes">${htmlEscape(String(likes))}</div>
                        <div class="resource-tile_info-meta_views">${htmlEscape(viewsFormatted)}</div>
                        ${(currentCategoryFromFilters !== "assets" && currentCategoryFromFilters !== "comics") ? `<div class="resource-tile_info-meta_rating">${ratingDisplay}</div>` : ""}
                        <div class="resource-tile_rating"><span style="width:${ratingWidth}%"></span></div>
                    </div>
                </div>
            </div>
        </a>
        <!-- Hover elements like buttons, gallery, tags are added by latest.min.js on mouseenter -->
    `;
    return tile;
}

    async function loadMoreItems() {
        if (isLoading || noMorePages) { return; }
        isLoading = true;
        const basePage = Number(currentPage);
        if (isNaN(basePage)) {
            console.error(`loadMoreItems: currentPage is NaN! Val: ${currentPage}`);
            isLoading = false; noMorePages = true;
            const elT = document.getElementById('infinite-scroll-trigger'); if (elT) elT.classList.add('no-more');
            return;
        }
        const nextPageToLoad = basePage + 1;
        const loadTrigger = document.getElementById('infinite-scroll-trigger');
        if (loadTrigger) loadTrigger.classList.add('loading');

        try {
            const ajaxParams = new URLSearchParams(currentFilters);
            ajaxParams.set('cmd', 'list'); ajaxParams.set('page', nextPageToLoad.toString());
            ajaxParams.set('rows', itemsPerRow.toString()); ajaxParams.set('_', Date.now().toString());
            const urlToFetch = `${AJAX_ENDPOINT_URL}?${ajaxParams.toString()}`;

            const response = await fetch(urlToFetch, {
                method: 'GET',
                headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json, text/javascript, */*; q=0.01' }
            });

            if (!response.ok) {
                console.error(`loadMoreItems: Failed fetch. Status: ${response.status}`);
                noMorePages = true; if (loadTrigger) { loadTrigger.classList.remove('loading'); loadTrigger.classList.add('no-more'); }
                return;
            }

            const responseData = await response.json();
            if (responseData && responseData.status === 'ok' && responseData.msg && responseData.msg.data) {
                const newItemsData = responseData.msg.data;
                const container = document.querySelector(itemContainerSelector);

                if (newItemsData.length > 0 && container) {
                    const fragment = document.createDocumentFragment();
                    const addedElements = [];
                    newItemsData.forEach(itemData => {
                        const itemElement = createItemElement(itemData);
                        fragment.appendChild(itemElement);
                        addedElements.push(itemElement);
                    });
                    container.appendChild(fragment);

                    if (typeof XF !== 'undefined' && typeof XF.activate === 'function') {
                        addedElements.forEach(el => XF.activate(el));
                    }
                    currentPage = nextPageToLoad;
                    highlightUnreadLinks();

                    if (responseData.msg.pagination && responseData.msg.pagination.page >= responseData.msg.pagination.total) {
                        noMorePages = true; if (loadTrigger) loadTrigger.classList.add('no-more');
                    }
                } else {
                    noMorePages = true; if (loadTrigger) loadTrigger.classList.add('no-more');
                }
            } else {
                noMorePages = true; if (loadTrigger) loadTrigger.classList.add('no-more');
                console.error(`loadMoreItems: AJAX response error or bad data.`, responseData);
            }
        } catch (error) {
            console.error('loadMoreItems: Error during AJAX/processing:', error);
            noMorePages = true; if (loadTrigger) { loadTrigger.classList.remove('loading'); loadTrigger.classList.add('no-more'); }
        } finally {
            isLoading = false;
            if (loadTrigger && !noMorePages) loadTrigger.classList.remove('loading');
        }
    }

    function actualInitInfiniteScroll() {
        if (infiniteScrollInitialized) return;
        const mainContentArea = document.querySelector(itemContainerSelector);
        if (!mainContentArea || !mainContentArea.querySelector(itemSelector)) { console.warn('actualInit: Container/initial items not found.'); return; }
        currentPage = getCurrentPageFromUrl(); currentFilters = getCurrentFiltersFromUrl();
        if (isNaN(Number(currentPage))) { console.error("actualInit: currentPage NaN, forcing 1"); currentPage = 1; }
        infiniteScrollInitialized = true; console.log(`actualInit: page ${currentPage}, filters '${currentFilters}'`);
        if (typeof latestUpdates !== 'undefined' && latestUpdates.options) { siteOptions = latestUpdates.options; itemsPerRow = parseInt(siteOptions.rows, 10) || 90;} else if (typeof siteOptions !== 'undefined' && siteOptions.rows) { itemsPerRow = parseInt(siteOptions.rows, 10) || 90; } else { console.warn("actualInit: latestUpdates.options not found, using script defaults for siteOptions."); }
        const loadTrigger = document.createElement('div'); loadTrigger.id = 'infinite-scroll-trigger'; mainContentArea.insertAdjacentElement('afterend', loadTrigger);
        const observer = new IntersectionObserver(entries => { if (entries[0].isIntersecting && !isLoading && !noMorePages) loadMoreItems();}, { threshold: 0.01 });
        observer.observe(loadTrigger);
        const filterChangeObserver = new MutationObserver((mutationsList) => { for (const mutation of mutationsList) { if (mutation.type === 'childList' && mutation.removedNodes.length > 0 && Array.from(mutation.addedNodes).some(n => n.matches && n.matches(itemSelector))) { setTimeout(() => { currentPage = getCurrentPageFromUrl(); currentFilters = getCurrentFiltersFromUrl(); if(isNaN(Number(currentPage))) currentPage=1; noMorePages=false; isLoading=false; if(loadTrigger)loadTrigger.className=''; if(!mainContentArea.querySelector(itemSelector)){noMorePages=true;if(loadTrigger)loadTrigger.classList.add('no-more');}},300); break;}}});
        filterChangeObserver.observe(mainContentArea, { childList: true });
    }

    // --- Styles ---
    const style = document.createElement('style');
    style.innerHTML = `
        .pageContent {max-width: ${windowWidth * 0.95}px !important;max-height: 360px !important;transition: none !important;top: 110px !important;}
        .p-body-inner, .p-nav-inner {max-width: ${windowWidth * 0.95}px !important;margin-left: auto !important;margin-right: auto !important;transition: none !important;box-sizing: border-box !important;}
        .cover-hasImage {height: 360px !important;transition: none !important;}
        .p-sectionLinks,.uix_extendedFooter,.p-footer-inner,.view-thread.block--similarContents.block-container,.js-notices.notices--block.notices, ${originalPaginationSelector} {display: none !important;}
        .highlight-unread {color: cyan;font-weight: bold;text-shadow: 1px 1px 2px black;}
        .uix_contentWrapper {max-width: 100% !important;padding-left: 5px !important;padding-right: 5px !important;box-sizing: border-box !important;}
        .p-body-main--withSideNav {display: flex !important;flex-direction: row !important;max-width: 100% !important;padding: 0 !important;box-sizing: border-box !important;}
        main#latest-page_main-wrap {flex-grow: 1 !important;margin-left: 0 !important;margin-right: 10px !important;min-width: 0;box-sizing: border-box !important;}
        aside#latest-page_filter-wrap {flex-shrink: 0 !important;width: 280px !important;margin-left: 0 !important;margin-right: 0 !important;box-sizing: border-box !important;}
        aside#latest-page_filter-wrap.filter-hidden,aside#latest-page_filter-wrap[style*="display:none"] {display: none !important;}
        main#latest-page_main-wrap:has(+ aside#latest-page_filter-wrap.filter-hidden),main#latest-page_main-wrap:has(+ aside#latest-page_filter-wrap[style*="display:none"]) {margin-right: 0 !important;}
        div#latest-page_items-wrap {width: 100% !important;margin-left: 0 !important;box-sizing: border-box !important;}
        ${itemContainerSelector}.resource-wrap-game.grid-normal {display: grid !important;grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)) !important;gap: 15px !important;padding: 0 !important;box-sizing: border-box !important;}
        #infinite-scroll-trigger {padding: 20px;text-align: center;font-size: 1.2em;color: #777; border: 1px solid transparent !important; min-height: 40px !important; margin-top: 10px !important; }
        #infinite-scroll-trigger.loading::after {content: "Loading more items...";}
        #infinite-scroll-trigger.no-more::after {content: "No more items to load.";}
        .userscript-generated-tile .resource-tile_thumb { background-size: cover; background-position: center; background-repeat: no-repeat; }
        .userscript-generated-tile .resource-tile_dev.fas.fa-user::before { margin-right: 0.3em; }
    `;
    document.documentElement.appendChild(style);

    // --- Start Execution ---
    highlightUnreadLinks();
    setTimeout(() => {
        const mainContentArea = document.querySelector(itemContainerSelector);
        if (mainContentArea && mainContentArea.querySelector(itemSelector)) {
            actualInitInfiniteScroll();
        } else {
            console.error("Initial items NOT found after 3s for init. Check itemSelector or site loading.");
        }
    }, 3000);

})();
