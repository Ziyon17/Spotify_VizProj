// 全域變數
let svg, simulation;
let sampleData;
let selectedCountries = new Set();
let activeContinent = null;
// 新增：歌曲節點映射
const songMap = new Map();
// 新增：藝術家照片映射
const artistPhotoMap = new Map();
// 新增：filteredData 作為全局變數
let filteredData = [];

// ===== 新增：用來儲存「多國 Rank=1 且人氣最高歌曲」的預設歌曲資料 =====
let defaultSongData = null;

/**
 * 讀取 CSV 檔案
 */
async function loadCSVData() {
    try {
        sampleData = await d3.csv('W1_Total_Playlist.csv', d => {
            return {
                ...d,
                Popularity: +d.Popularity,
                Duration_ms: +d['Duration (ms)'],
                Track_Number: +d['Track Number'],
                Explicit: d.Explicit === 'True',
                Rank: +d.Rank // 加入 Rank 轉換
            };
        });
        console.log('CSV 讀取成功:', sampleData.slice(0, 5));
        return sampleData;
    } catch (error) {
        console.error('讀取 CSV 錯誤:', error);
        throw error;
    }
}

/**
 * 初始化按鈕事件處理
 */
function setupMenuListeners() {
   const menuItems = document.querySelectorAll('.menu-item');

   // 新增用於顯示選定國家的容器
   const navMenu = document.querySelector('.nav-menu');
   const selectedCountriesDiv = document.createElement('div');
   selectedCountriesDiv.id = 'selected-countries';
   selectedCountriesDiv.className = 'selected-countries';
   navMenu.appendChild(selectedCountriesDiv);

   menuItems.forEach(item => {
       const menuBtn = item.querySelector('.menu-btn');
       const submenu = item.querySelector('.submenu');
       const countryButtons = submenu.querySelectorAll('button');

       // 洲別按鈕點擊事件
       menuBtn.addEventListener('click', (e) => {
           e.stopPropagation();
           const continent = menuBtn.textContent;
           const isActive = submenu.style.display === 'block';

           // 隱藏所有子選單
           document.querySelectorAll('.submenu').forEach(menu => {
               if (menu !== submenu) {
                   menu.style.display = 'none';
               }
           });

           // 切換當前選單的顯示狀態
           if (!isActive) {
               submenu.style.display = 'block';
               activeContinent = continent;
           } else {
               submenu.style.display = 'none';
               activeContinent = null;
           }
       });

       // 國家按鈕點擊事件
       countryButtons.forEach(button => {
           button.addEventListener('click', (e) => {
               e.stopPropagation();
               const country = button.getAttribute('data-country');

               if (selectedCountries.has(country)) {
                   selectedCountries.delete(country);
                   button.classList.remove('selected');
               } else {
                   selectedCountries.add(country);
                   button.classList.add('selected');
               }

               updateSelectedCountriesDisplay();
               updateVisualization();
           });
       });

       // 全選/取消全選功能（雙擊）
       menuBtn.addEventListener('dblclick', (e) => {
           e.stopPropagation();
           const allSelected = Array.from(countryButtons).every(btn =>
               btn.classList.contains('selected')
           );

           countryButtons.forEach(button => {
               const country = button.getAttribute('data-country');
               if (allSelected) {
                   selectedCountries.delete(country);
                   button.classList.remove('selected');
               } else {
                   selectedCountries.add(country);
                   button.classList.add('selected');
               }
           });

           updateSelectedCountriesDisplay();
           updateVisualization();
       });
   });

   // 點擊空白處的處理
   document.addEventListener('click', (e) => {
       if (!e.target.closest('.menu-item')) {
           document.querySelectorAll('.submenu').forEach(menu => {
               menu.style.display = 'none';
           });
           activeContinent = null;
       }
   });

   // logo 點擊事件
   document.querySelector('#logo img').addEventListener('click', () => {
       selectedCountries.clear();
       document.querySelectorAll('.submenu button').forEach(btn => {
           btn.classList.remove('selected');
       });
       document.querySelectorAll('.submenu').forEach(menu => {
           menu.style.display = 'none';
       });
       activeContinent = null;

       // Reset filters
       explicitFilter = false;
       document.getElementById('explicit-toggle').checked = false;
       document.querySelector('.explicit-filter span').textContent = 'Included Explicit';

       durationFilter = 'all';
       document.getElementById('duration-select').value = 'all';

       // Initialize Taiwan
       const taiwanButton = document.querySelector('button[data-country="Taiwan"]');
       if (taiwanButton) {
           taiwanButton.classList.add('selected');
           selectedCountries.add('Taiwan');
       }

       updateSelectedCountriesDisplay();
       updateVisualization();
   });
}

/**
 * 建立多國家 Network 資料
 */
function createMultiCountryNetwork(filteredData) {
    // 在函數開始處清除之前的 Map
    songMap.clear();
    artistPhotoMap.clear();
    const nodes = [];
    const links = [];
    const nodeIds = new Set();

    // 按國家分組並計算數據
    const countryGroups = {};
    filteredData.forEach(row => {
        if (!countryGroups[row.Country]) {
            countryGroups[row.Country] = {
                songs: new Set(),
                artists: new Set(),
                data: [],
                continent: row.Continent
            };
        }
        countryGroups[row.Country].songs.add(row.Song);
        countryGroups[row.Country].artists.add(row.Artist);
        countryGroups[row.Country].data.push(row);
    });

    // 為每個國家創建節點和連接
    Object.entries(countryGroups).forEach(([country, group]) => {
       // 添加國家節點
        const countryNode = {
            id: country,
            name: country,
            type: 'country',
            continent: group.continent,
            radius: 40,
            innerRadius: 35,
            outerRadius: 40
        };
        nodes.push(countryNode);
        nodeIds.add(country);

        // 處理所有藝術家
        Array.from(group.artists).forEach(artist => {
            if (!nodeIds.has(artist)) {
                const artistSongs = group.data.filter(song => song.Artist === artist);
                const artistPhotoUrl = artistSongs.length > 0 ? artistSongs[0]['Artist Photo URL'] : null;

                const artistNode = {
                    id: artist,
                    name: artist,
                    type: 'artist',
                    continent: group.continent,
                    radius: 10,
                    innerRadius: 6,
                    outerRadius: 10,
                    artistPhotoUrl: artistPhotoUrl
                };
                nodes.push(artistNode);
                nodeIds.add(artist);

                // 存儲藝術家照片 URL
                artistPhotoMap.set(artist, artistPhotoUrl);
            }
            links.push({
                source: country,
                target: artist,
                value: 1
            });
        });

        // 處理所有歌曲
        group.data.forEach(row => {
            if (!nodeIds.has(row.Song)) {
                const songNode = {
                    id: row.Song,
                    name: row.Song,
                    type: 'song',
                    artist: row.Artist,
                    continent: group.continent,
                    popularity: row.Popularity,
                    releaseDate: row['Release Date'],
                    artistPhotoUrl: artistPhotoMap.get(row.Artist),
                    previewUrl: row['Preview URL'],
                    rank: row.Rank,
                    radius: 4,
                    innerRadius: 5,
                    outerRadius: 6
                };
                nodes.push(songNode);
                nodeIds.add(row.Song);

                // 存儲歌曲節點
                songMap.set(row.Song, songNode);

                links.push({
                    source: row.Artist,
                    target: row.Song,
                    value: 1
                });
            }
        });
    });

    return { nodes, links };
}

/**
 * 更新藝人資訊至側邊欄
 */
function updateArtistInfo(artistName) {
    // 過濾出該藝術家的所有歌曲
    const artistSongs = filteredData.filter(d => d.Artist === artistName);

    if (artistSongs.length === 0) {
        console.warn('該藝術家沒有歌曲資料:', artistName);
        return;
    }

    // 計算藝術家的平均人氣
    const totalPopularity = artistSongs.reduce((sum, song) => sum + song.Popularity, 0);
    const averagePopularity = totalPopularity / artistSongs.length;

    // 更新人氣指標
    updatePopularityMeter(averagePopularity);

    // 更新藝術家照片
    const artistPhotoUrl = artistPhotoMap.get(artistName);
    const artistPhoto = document.getElementById('artist-photo');
    if (artistPhotoUrl) {
        artistPhoto.src = artistPhotoUrl;
    } else {
        artistPhoto.src = '/api/placeholder/200/200';
    }
    artistPhoto.alt = artistName || 'Artist Photo';

    // 更新歌曲資訊區域
    document.getElementById('song-info').style.display = 'none';

    // 去除重複歌曲
    const uniqueSongsMap = new Map();
    artistSongs.forEach(song => {
        if (!uniqueSongsMap.has(song.Song)) {
            uniqueSongsMap.set(song.Song, song);
        }
    });
    const uniqueArtistSongs = Array.from(uniqueSongsMap.values());

    // 更新藝術家歌曲列表
    const songsList = document.getElementById('songs-list');
    songsList.innerHTML = '';

    uniqueArtistSongs.forEach(song => {
        const li = document.createElement('li');
        li.textContent = song.Song;
        li.addEventListener('click', () => {
            const songNode = songMap.get(song.Song);
            if (songNode) {
                updateSongInfo(songNode);
            } else {
                updateSongInfo(song);
            }
        });
        songsList.appendChild(li);
    });

    // 顯示藝術家歌曲列表區域
    document.getElementById('artist-songs').style.display = 'block';
}

/**
 * 更新半圓形進度條
 */
function updatePopularityMeter(popularity) {
    const meterProgress = document.querySelector('.meter-progress');
    const popularityValue = document.querySelector('.popularity-value');

    // 計算弧長
    const length = 260; // 弧的總長度
    if (!popularity && popularity !== 0) {
        // 初始狀態
        meterProgress.style.strokeDasharray = `0 ${length}`;
        popularityValue.textContent = '0';
    } else {
        // 更新狀態
        const progress = (popularity / 100) * length;
        meterProgress.style.strokeDasharray = `${progress} ${length}`;
        popularityValue.textContent = popularity.toFixed(0);
    }
}

/**/
function updateSongInfo(songData) {
    // 更新人氣指標
    updatePopularityMeter(songData.popularity);

    // 更新藝術家照片
    const artistPhoto = document.getElementById('artist-photo');
    if (songData.artistPhotoUrl) {
        artistPhoto.src = songData.artistPhotoUrl;
    } else {
        artistPhoto.src = '/api/placeholder/200/200';
    }
    artistPhoto.alt = songData.artist || 'Artist Photo';

    // 更新歌曲資訊
    document.getElementById('song-title').textContent = songData.name;
    document.getElementById('artist-name').textContent = songData.artist || '';
    document.getElementById('release-date').textContent = songData.releaseDate || '';

    // 處理多國排名資訊
    const sameSongEntries = filteredData.filter(d =>
        d.Song === songData.name && selectedCountries.has(d.Country)
    );

    if (sameSongEntries.length > 0) {
        // 將 entries 按 rank 分組
        const rankGroups = {};
        sameSongEntries.forEach(entry => {
            if (!rankGroups[entry.Rank]) {
                rankGroups[entry.Rank] = [];
            }
            rankGroups[entry.Rank].push(entry);
        });

        // 清空現有的 rank 顯示
        const rankContainer = document.getElementById('song-rank');
        rankContainer.innerHTML = '';

        // 按 rank 排序並創建顯示元素
        Object.keys(rankGroups)
            .sort((a, b) => Number(a) - Number(b))
            .forEach((rank, index) => {
                const rankDiv = document.createElement('div');
                rankDiv.className = 'rank-group';

                // 只在第一個 rank 時顯示 "#" 號
                const rankNum = document.createElement('span');
                rankNum.className = 'rank-number';
                rankNum.textContent = `#${rank}`;
                rankDiv.appendChild(rankNum);

                // 為每個國家創建 flag
                rankGroups[rank]
                    .sort((a, b) => a.Country.localeCompare(b.Country))
                    .forEach(entry => {
                        const flagContainer = document.createElement('div');
                        flagContainer.className = 'flag-container';

                        const flagSpan = document.createElement('span');
                        flagSpan.className = 'country-flag';
                        flagSpan.textContent = getCountryFlag(entry.Country);

                        const tooltip = document.createElement('span');
                        tooltip.className = 'flag-tooltip';
                        tooltip.textContent = entry.Country;

                        flagContainer.appendChild(flagSpan);
                        flagContainer.appendChild(tooltip);
                        rankDiv.appendChild(flagContainer);
                    });

                rankContainer.appendChild(rankDiv);
            });
    } else {
        document.getElementById('song-rank').textContent = '';
    }

    // 更新播放按鈕
    const previewButton = document.getElementById('preview-button');
    if (songData.previewUrl) {
        previewButton.style.display = 'inline-block';
        previewButton.href = songData.previewUrl;
    } else {
        previewButton.style.display = 'none';
    }

    // 更新 UI 顯示狀態
    document.getElementById('song-info').style.display = 'block';
    document.getElementById('artist-songs').style.display = 'none';
}

// 確保這個 getCountryFlag 函數在你的程式碼中有定義
function getCountryFlag(country) {
    const countryToFlag = {
        'Taiwan': '🇹🇼',
        'Japan': '🇯🇵',
        'South Korea': '🇰🇷',
        'USA': '🇺🇸',
        'China': '🇨🇳',
        'Malaysia': '🇲🇾',
        'Canada': '🇨🇦',
        'Mexico': '🇲🇽',
        'Dominican Republic': '🇩🇴',
        'Colombia': '🇨🇴',
        'France': '🇫🇷',
        'Italy': '🇮🇹',
        'Spain': '🇪🇸',
        'Germany': '🇩🇪',
        'England': '🇬🇧',
        'South Africa': '🇿🇦',
        'Morocco': '🇲🇦',
        'Egypt': '🇪🇬',
        'Nigeria': '🇳🇬',
        'Australia': '🇦🇺',
        'New Zealand': '🇳🇿'
    };
    return countryToFlag[country] || '🏳️';
}

/**
 * 自訂外觀：若藝人屬於超過一個國家（mutualCount > 1），繪製綠色方形且顯示數字
 */
function updateNodeStyle(node) {
    const getMutualCountries = (artistName) => {
        const artistCountries = new Set();
        filteredData.forEach(d => {
            if (d.Artist === artistName) {
                artistCountries.add(d.Country);
            }
        });
        return artistCountries.size;
    };

    node.each(function(d) {
        if (d.type === 'artist') {
            const el = d3.select(this);
            const mutualCount = getMutualCountries(d.name);

            if (mutualCount > 1) {
                // 移除原有圓形
                el.select('circle').remove();

                // 方形大小隨 mutualCount 變化
                const size = d.radius * (0.8  + mutualCount * 0.035);

                // 添加方形
                el.insert('rect', 'text')
                    .attr('width', size * 2)
                    .attr('height', size * 2)
                    .attr('x', -size)
                    .attr('y', -size)
                    .attr('fill', '#1DB954')
                    .attr('class', 'artist-shape');

                // 添加數字
                el.select('.count-text').remove();
                el.append('text')
                    .attr('class', 'count-text')
                    .text(mutualCount)
                    .attr('fill', 'white')
                    .attr('text-anchor', 'middle')
                    .attr('dy', '0.3em')
                    .style('font-size', '10px');
            }
        }
    });
}

/**
 * 設定節點互動：點擊與空白處點擊的行為
 */
// 修改：點擊空白處後，恢復顯示「多國 Rank=1 歌曲中最高人氣的那一首」的資訊
function updateNodeInteractions(node, link) {
    // 為了在 resetHighlight() 也能判斷跨國藝人數量，重複定義一個同名函式
    function getMutualCountries(artistName) {
        const artistCountries = new Set();
        filteredData.forEach(d => {
            if (d.Artist === artistName) {
                artistCountries.add(d.Country);
            }
        });
        return artistCountries.size;
    }

    function resetHighlight() {
        // 恢復所有節點、連線的透明度
        node.style('opacity', 1);
        link.style('opacity', 0.6);

        // 先將所有節點文字都隱藏
        node.selectAll('text').style('display', 'none');

        // 只顯示國家文字
        node.filter(d => d.type === 'country')
            .select('text')
            .style('display', 'block');

        // 重新顯示「綠色方形藝人節點」的數字
        node.filter(d => d.type === 'artist').each(function(d) {
            const el = d3.select(this);
            const mutualCount = getMutualCountries(d.name);
            if (mutualCount > 1) {
                // 再度顯示方形上的數字
                el.select('.count-text').style('display', 'block');
            }
        });

        // 新增：回復預設歌曲資訊（多國 Rank=1 歌曲中人氣最高者）
        if (defaultSongData) {
            updateSongInfo(defaultSongData);
        }
    }

    function highlightConnections(selectedNode) {
        node.style('opacity', 0.2);
        link.style('opacity', 0.2);

        // 全部文字先隱藏
        node.selectAll('text').style('display', 'none');

        // 保留國家文字
        node.filter(d => d.type === 'country').select('text').style('display', 'block');

        const connected = new Set();
        connected.add(selectedNode.id);

        if (selectedNode.type === 'country') {
            // 找出該國家第一名的歌曲
            const rank1Song = filteredData.find(d => d.Country === selectedNode.id && d.Rank === 1);

            link.each(function(d) {
                if (d.source.id === selectedNode.id || d.target.id === selectedNode.id) {
                    connected.add(d.source.id);
                    connected.add(d.target.id);

                    // 顯示藝術家文字
                    if (d.target.type === 'artist') {
                        node.filter(n => n.id === d.target.id)
                            .select('text')
                            .style('display', 'block');
                    }

                    // 顯示該國家第一名歌曲
                    if (rank1Song && d.target.type === 'song' && d.target.id === rank1Song.Song) {
                        node.filter(n => n.id === d.target.id)
                            .select('text')
                            .style('display', 'block');
                    }
                }
            });
        } else if (selectedNode.type === 'artist') {
            link.each(function(d) {
                if (d.source.id === selectedNode.id || d.target.id === selectedNode.id) {
                    connected.add(d.source.id);
                    connected.add(d.target.id);
                }
            });

            // 永久顯示該歌手及其歌曲
            node.filter(n => n.id === selectedNode.id ||
                           (n.type === 'song' && n.artist === selectedNode.name))
                .select('text')
                .style('display', 'block');
        }

        // 高亮
        node.style('opacity', d => connected.has(d.id) ? 1 : 0.2);
        link.style('opacity', d => connected.has(d.source.id) && connected.has(d.target.id) ? 0.6 : 0.2);
    }

    // 點選節點後高亮
    node.on('click', function(event, d) {
        event.stopPropagation();
        highlightConnections(d);

        // 根據節點類型更新右側資訊
        if (d.type === 'country') {
            const rank1Song = filteredData.find(song => song.Country === d.id && song.Rank === 1);
            if (rank1Song) {
                updateSongInfo({
                    name: rank1Song.Song,
                    artist: rank1Song.Artist,
                    popularity: rank1Song.Popularity,
                    releaseDate: rank1Song['Release Date'],
                    artistPhotoUrl: rank1Song['Artist Photo URL'],
                    previewUrl: rank1Song['Preview URL'],
                    rank: rank1Song.Rank
                });
            }
        } else if (d.type === 'song') {
            updateSongInfo(d);
        } else if (d.type === 'artist') {
            updateArtistInfo(d.name);
        }
    });

    // 點選空白處後重置
    svg.on('click', resetHighlight);
}

/**
 * 建立圖形視覺化
 */
function createVisualization(filteredData) {
    svg = d3.select('#graph');
    svg.selectAll('*').remove();

    if (filteredData.length === 0) return;

    const graphContainer = document.getElementById('graph-container');
    const width = graphContainer.clientWidth;
    const height = graphContainer.clientHeight;
    const { nodes, links } = createMultiCountryNetwork(filteredData);

    // Initialize zoom with updated bounds
    const zoom = d3.zoom()
        .scaleExtent([0.2, 5])
        .on('zoom', (event) => {
            container.attr('transform', event.transform);
        });

    svg.call(zoom);
    const container = svg.append('g');

    // Bind zoom button events
    document.getElementById('zoom-in').onclick = () => {
        zoom.scaleBy(svg.transition().duration(300), 1.3);
    };
    document.getElementById('zoom-out').onclick = () => {
        zoom.scaleBy(svg.transition().duration(300), 0.7);
    };

    // Fullscreen functionality
    const fullscreenBtn = document.getElementById('fullscreen');

    fullscreenBtn.onclick = () => {
        if (!document.fullscreenElement) {
            graphContainer.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    };

    // Update SVG on fullscreen change
    const updateSvgSize = () => {
        const newWidth = graphContainer.clientWidth;
        const newHeight = graphContainer.clientHeight;
        svg
            .attr('width', newWidth)
            .attr('height', newHeight);
        simulation
            .force('center', d3.forceCenter(newWidth / 2, newHeight / 2))
            .alpha(0.3)
            .restart();
    };

    document.addEventListener('fullscreenchange', () => {
        updateSvgSize();
    });

    // D3 force simulation setup
    simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(d => {
            if (d.source.type === 'country') return width * 0.15;
            return width * 0.08;
        }))
        .force('charge', d3.forceManyBody().strength(d => {
            if (d.type === 'country') return -width * 0.5;
            if (d.type === 'artist') return -width * 0.2;
            return -width * 0.1;
        }))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(d => {
            if (d.type === 'country') return d.radius * 1.5;
            if (d.type === 'artist') return d.radius * 1.2;
            return d.radius * 1.1;
        }))
        .force('x', d3.forceX(width / 2).strength(0.1))
        .force('y', d3.forceY(height / 2).strength(0.1));

    // Draw links
    const link = container.append('g')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
        .attr('stroke-width', 1);

    // Draw nodes
    const node = container.append('g')
        .selectAll('g')
        .data(nodes)
        .join('g')
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));

    // Color mapping
    const getColor = (continent) => {
        switch(continent) {
            case 'Asia': return '#4abec0';      // Teal
            case 'America': return '#FFB6C1';   // Pink
            case 'Europe': return '#3d62d0';    // Navy blue
            case 'Africa': return '#FFA500';    // Orange
            case 'Oceania': return '#a485e3';   // Purple
            default: return '#999';
        }
    };

    // Draw nodes by type
    node.each(function(d) {
        const el = d3.select(this);
        const color = getColor(d.continent);

        if (d.type === 'country') {
            el.append('circle')
                .attr('r', d.outerRadius)
                .attr('fill', 'white')
                .attr('stroke', color)
                .attr('stroke-width', 4);

            el.append('text')
                .text(d.name)
                .attr('fill', color)
                .attr('text-anchor', 'middle')
                .attr('dy', '0.3em')
                .style('font-size', '12px')
                .style('font-weight', 'bold');
        } else if (d.type === 'artist') {
            el.append('circle')
                .attr('r', d.radius)
                .attr('fill', color)
                .attr('fill-opacity', 1);
        } else {
            el.append('circle')
                .attr('r', d.radius)
                .attr('fill', '#fff')
                .attr('stroke', '#999')
                .attr('stroke-width', 1);
        }
    });

    // Add text labels for songs and artists (hidden by default)
    node.filter(d => d.type !== 'country')
        .append('text')
        .text(d => d.name)
        .attr('dy', d => d.radius + 10)
        .style('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', '#666')
        .style('display', 'none');

    // Set up legend interactions
    function setupLegendInteractions() {
        function isMutualArtist(artistName) {
            const artistCountries = new Set();
            filteredData.forEach(d => {
                if (d.Artist === artistName) {
                    artistCountries.add(d.Country);
                }
            });
            return artistCountries.size > 1;
        }

        document.querySelectorAll('.legend-item').forEach(legendItem => {
            legendItem.addEventListener('click', function() {
                const legendShape = this.querySelector('.legend-shape');
                const legendClasses = Array.from(legendShape.classList);
                const legendType = legendClasses.find(cls =>
                    ['asia', 'america', 'europe', 'africa', 'oceania', 'mutual'].includes(cls)
                );

                node.each(function(d) {
                    const nodeEl = d3.select(this);
                    let opacity = 0.2;
                    let showText = false;

                    if (legendType === 'mutual') {
                        if (d.type === 'artist' && isMutualArtist(d.name)) {
                            opacity = 1;
                            showText = true;
                        }
                        if (d.type === 'country') {
                            const hasArtist = filteredData.some(item =>
                                item.Country === d.name &&
                                isMutualArtist(item.Artist)
                            );
                            opacity = hasArtist ? 1 : 0.2;
                        }
                    } else {
                        if (d.continent?.toLowerCase() === legendType) {
                            opacity = 1;
                            showText = (d.type === 'artist');
                        }
                    }

                    nodeEl.transition()
                        .duration(300)
                        .style('opacity', opacity);

                    if (d.type === 'artist') {
                        nodeEl.select('text')
                            .style('display', showText ? 'block' : 'none');
                    }
                });

                link.transition()
                    .duration(300)
                    .style('opacity', d => {
                        if (legendType === 'mutual') {
                            return (d.source.type === 'artist' && isMutualArtist(d.source.name)) ||
                                   (d.target.type === 'artist' && isMutualArtist(d.target.name))
                                   ? 0.6 : 0.1;
                        } else {
                            const sourceMatch = d.source.continent?.toLowerCase() === legendType;
                            const targetMatch = d.target.continent?.toLowerCase() === legendType;
                            return (sourceMatch || targetMatch) ? 0.6 : 0.1;
                        }
                    });
            });
        });

        svg.on('click', function(event) {
            if (event.target === this) {
                node.transition()
                    .duration(300)
                    .style('opacity', 1);

                link.transition()
                    .duration(300)
                    .style('opacity', 0.6);

                node.filter(d => d.type === 'artist')
                    .select('text')
                    .style('display', 'none');

                if (defaultSongData) {
                    updateSongInfo(defaultSongData);
                }
            }
        });
    }

    // Mouse events
    node.on('mouseover', function(event, d) {
        if (d.type !== 'country') {
            d3.select(this).select('text').style('display', 'block');
        }
    }).on('mouseout', function(event, d) {
        if (d.type !== 'country') {
            d3.select(this).select('text').style('display', 'none');
        }
    });

    // Update node styles and interactions
    updateNodeStyle(node);
    updateNodeInteractions(node, link);
    setupLegendInteractions();

    // Force simulation tick
    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Initial size setting
    updateSvgSize();
}

// 修改：每次重建圖之後，都要更新 defaultSongData（多國 Rank=1 中人氣最高者），並在尚未點擊特定節點時顯示
function updateLegend() {
    // 先隱藏所有圖例
    document.querySelectorAll('.legend-item').forEach(item => {
        item.style.display = 'none';
    });

    if (selectedCountries.size === 0) {
        return; // 如果沒有選擇國家，不顯示任何圖例
    }

    // 找出所有選中國家的大洲
    const selectedContinents = new Set();
    filteredData.forEach(d => {
        if (selectedCountries.has(d.Country)) {
            selectedContinents.add(d.Continent.toLowerCase());
        }
    });

    // 顯示選中大洲的圖例
    selectedContinents.forEach(continent => {
        const legendItem = document.querySelector(`.${continent}-legend`);
        if (legendItem) {
            legendItem.style.display = 'flex';
        }
    });

    // 檢查是否有跨國藝人
    const hasMutualArtists = filteredData.some(d => {
        const artistCountries = new Set();
        filteredData.forEach(item => {
            if (item.Artist === d.Artist) {
                artistCountries.add(item.Country);
            }
        });
        return artistCountries.size > 1;
    });

    // 只有在有跨國藝人時才顯示 mutual 圖例
    if (hasMutualArtists) {
        const mutualLegend = document.querySelector('.mutual-legend');
        if (mutualLegend) {
            mutualLegend.style.display = 'flex';
        }
    }
}

// 修改：新增找出多國 Rank=1 歌曲中人氣最高者的邏輯
function updateVisualization() {
    if (!sampleData || selectedCountries.size === 0) {
        svg.selectAll('*').remove();
        // Reset sidebar
        updatePopularityMeter(null);
        document.getElementById('artist-photo').src = '/api/placeholder/200/200';
        document.getElementById('artist-photo').alt = 'Artist Photo';
        document.getElementById('song-title').textContent = '選擇一首歌曲來查看詳情';
        document.getElementById('artist-name').textContent = '';
        document.getElementById('release-date').textContent = '';
        document.getElementById('song-rank').textContent = '';
        document.getElementById('preview-button').style.display = 'none';
        document.getElementById('song-info').style.display = 'block';
        document.getElementById('artist-songs').style.display = 'none';
        document.getElementById('songs-list').innerHTML = '';
        updateLegend();
        return;
    }

    // Apply all filters
    filteredData = sampleData.filter(d => {
        if (!selectedCountries.has(d.Country)) return false;
        if (explicitFilter && !d.Explicit) return false;
        const durationInMinutes = d.Duration_ms / 60000;
        if (durationFilter !== 'all') {
            switch(durationFilter) {
                case 'short': if (durationInMinutes >= 3) return false; break;
                case 'medium': if (durationInMinutes < 3 || durationInMinutes > 5) return false; break;
                case 'long': if (durationInMinutes <= 5) return false; break;
            }
        }
        return true;
    });

    if (filteredData.length > 0) {
        createVisualization(filteredData);
        updateLegend();

        const currentArtists = new Set(filteredData.map(d => d.Artist));
        let allRelevantSongs = [];

        currentArtists.forEach(artist => {
            const artistSongs = sampleData
                .filter(d => {
                    if (d.Artist !== artist) return false;
                    const durationInMinutes = d.Duration_ms / 60000;
                    if (durationFilter !== 'all') {
                        switch(durationFilter) {
                            case 'short': if (durationInMinutes >= 3) return false; break;
                            case 'medium': if (durationInMinutes < 3 || durationInMinutes > 5) return false; break;
                            case 'long': if (durationInMinutes <= 5) return false; break;
                        }
                    }
                    return true;
                });

            if (artistSongs.length > 0) {
                allRelevantSongs.push(...artistSongs);
            }
        });

        // First try to find Rank 1 songs
        let rank1Songs = allRelevantSongs.filter(d => d.Rank === 1);

        let topSong;
        if (rank1Songs.length > 0) {
            // If there are Rank 1 songs, pick the one with highest popularity
            topSong = rank1Songs.reduce((highest, current) =>
                current.Popularity > highest.Popularity ? current : highest
            );
        } else {
            // If no Rank 1 songs, find the best rank available
            const bestRank = Math.min(...allRelevantSongs.map(d => d.Rank));
            const bestRankSongs = allRelevantSongs.filter(d => d.Rank === bestRank);
            // Among best rank songs, pick the one with highest popularity
            topSong = bestRankSongs.reduce((highest, current) =>
                current.Popularity > highest.Popularity ? current : highest
            );
        }

        if (topSong) {
            defaultSongData = {
                name: topSong.Song,
                artist: topSong.Artist,
                popularity: topSong.Popularity,
                releaseDate: topSong['Release Date'],
                artistPhotoUrl: topSong['Artist Photo URL'],
                previewUrl: topSong['Preview URL'],
                rank: topSong.Rank
            };
            updateSongInfo(defaultSongData);
        } else {
            defaultSongData = null;
            // Reset panel code remains the same...
        }
    } else {
        svg.selectAll('*').remove();
        updateLegend();
        defaultSongData = null;
    }
}

/**
 * 拖曳相關函數
 */
function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
}

function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
}

function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
}

/**
 * 初始化台灣 Rank 1 歌曲
 */
function initializeTaiwanRank1() {
    const taiwanButton = document.querySelector('button[data-country="Taiwan"]');
    if (taiwanButton) {
        taiwanButton.classList.add('selected');
        selectedCountries.add('Taiwan');
        updateVisualization();
    }
}

function updateSelectedCountriesDisplay() {
    const container = document.getElementById('selected-countries');
    container.innerHTML = 'Selected: ';

    const flagContainer = document.createElement('div');
    flagContainer.style.display = 'flex';
    flagContainer.style.gap = '4px';
    flagContainer.style.alignItems = 'center';
    flagContainer.style.marginLeft = '8px';

    selectedCountries.forEach(country => {
        const countryChip = document.createElement('div');
        countryChip.style.position = 'relative';

        const flag = document.createElement('span');
        flag.style.fontSize = '16px';
        flag.style.cursor = 'pointer';
        flag.textContent = getCountryFlag(country);

        const tooltip = document.createElement('span');
        tooltip.style.position = 'absolute';
        tooltip.style.top = '-30px';
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.style.background = 'rgba(0, 0, 0, 0.8)';
        tooltip.style.color = 'white';
        tooltip.style.padding = '4px 8px';
        tooltip.style.borderRadius = '4px';
        tooltip.style.fontSize = '12px';
        tooltip.style.opacity = '0';
        tooltip.style.visibility = 'hidden';
        tooltip.style.transition = 'all 0.2s';
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.textContent = country;

        countryChip.appendChild(flag);
        countryChip.appendChild(tooltip);

        // Show tooltip on hover
        countryChip.addEventListener('mouseenter', () => {
            tooltip.style.opacity = '1';
            tooltip.style.visibility = 'visible';
        });

        countryChip.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
            tooltip.style.visibility = 'hidden';
        });

        // Delete functionality
        countryChip.addEventListener('click', () => {
            selectedCountries.delete(country);
            const button = document.querySelector(`button[data-country="${country}"]`);
            if (button) button.classList.remove('selected');
            updateSelectedCountriesDisplay();
            updateVisualization();
        });

        flagContainer.appendChild(countryChip);
    });

    container.appendChild(flagContainer);
 }

// 全域變數部分新增
let explicitFilter = false;
let durationFilter = 'all';

function setupFilters() {
    const explicitToggle = document.getElementById('explicit-toggle');
    const durationSelect = document.getElementById('duration-select');
    const explicitText = document.querySelector('.explicit-filter span');

    if (!explicitToggle || !durationSelect) {
        console.warn('篩選器元素未找到');
        return;
    }

    explicitToggle.addEventListener('change', (e) => {
        explicitFilter = e.target.checked;
        explicitText.textContent = explicitFilter ? 'Explicit Only' : 'Included Explicit';
        updateVisualization();
    });

    durationSelect.addEventListener('change', (e) => {
        durationFilter = e.target.value;
        updateVisualization();
    });
}

/**
 * 初始化主流程
 */
async function initialize() {
    console.log('初始化中...');
    svg = d3.select('#graph');
    setupFilters(); // 加在這裡

    // 操作說明視窗相關元素
    const modal = document.getElementById('instruction-modal');
    const closeBtn = document.querySelector('.close-btn');
    const helpButton = document.getElementById('help-button');

    // 設置操作說明視窗的事件監聽
    closeBtn.addEventListener('click', () => {
        modal.style.display = "none";
        helpButton.classList.remove('hidden');
    });

    helpButton.addEventListener('click', () => {
        modal.style.display = "block";
        helpButton.classList.add('hidden');
    });

    // 點擊視窗外部關閉
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = "none";
            helpButton.classList.remove('hidden');
        }
    });

    try {
        await loadCSVData();
        console.log('數據載入成功');
        setupMenuListeners();

        // 添加 logo 點擊事件（點 logo 重置並自動載入台灣）
        document.querySelector('#logo img').addEventListener('click', () => {
            // Reset country selections
            selectedCountries.clear();
            document.querySelectorAll('.submenu button').forEach(btn => {
                btn.classList.remove('selected');
            });
            document.querySelectorAll('.submenu').forEach(menu => {
                menu.style.display = 'none';
            });

            // Reset filters to default
            explicitFilter = false;
            document.getElementById('explicit-toggle').checked = false;
            document.querySelector('.explicit-filter span').textContent = 'Included Explicit';

            durationFilter = 'all';
            document.getElementById('duration-select').value = 'all';

            // Initialize Taiwan as default
            const taiwanButton = document.querySelector('button[data-country="Taiwan"]');
            if (taiwanButton) {
                taiwanButton.classList.add('selected');
                selectedCountries.add('Taiwan');
            }

            // Update visualization with default settings
            updateVisualization();
        });

        // 初始化顯示操作說明視窗
        modal.style.display = "block";
        helpButton.classList.add('hidden');

        updatePopularityMeter(0);
        initializeTaiwanRank1();
    } catch (error) {
        console.error('初始化錯誤:', error);
    }
}
document.addEventListener('DOMContentLoaded', initialize);