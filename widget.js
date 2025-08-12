// Basic Spotify widget logic, similar to your main app but with widget-specific IDs
const clientId = 'd91f367c3a62465db529d844a632846b';
const redirectUri = window.location.origin + window.location.pathname;
let accessToken = '';

// PKCE helpers
function generateCodeVerifier(length = 128) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let codeVerifier = '';
    for (let i = 0; i < length; i++) {
        codeVerifier += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return codeVerifier;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// Auth flow
async function loginWithSpotify() {
    const codeVerifier = generateCodeVerifier();
    localStorage.setItem('widget_code_verifier', codeVerifier);
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    const scope = 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative';
    const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge_method=S256&code_challenge=${codeChallenge}`;
    window.location = authUrl;
}

document.getElementById('widget-login-btn').onclick = loginWithSpotify;

// Handle redirect
async function handleRedirect() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    const codeVerifier = localStorage.getItem('widget_code_verifier');
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier
    });
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
    });
    const data = await response.json();
    accessToken = data.access_token;
    window.history.replaceState({}, document.title, redirectUri);
    document.getElementById('widget-login-btn').style.display = 'none';
    document.getElementById('widget-player-main').style.display = 'block';
    getCurrentPlayback();
}

handleRedirect();

// Spotify API helpers
async function spotifyApi(endpoint, method = 'GET', body = null) {
    const url = `https://api.spotify.com/v1/${endpoint}`;
    const options = {
        method,
        headers: { 'Authorization': `Bearer ${accessToken}` }
    };
    if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    const res = await fetch(url, options);
    return await res.json();
}

// Playback controls
const playBtn = document.getElementById('widget-play-btn');
const nextBtn = document.getElementById('widget-next-btn');
const prevBtn = document.getElementById('widget-prev-btn');
const repeatBtn = document.getElementById('widget-repeat-btn');
const shuffleBtn = document.getElementById('widget-shuffle-btn');

let isPlaying = false;

playBtn.onclick = async function() {
    if (isPlaying) {
        await pauseTrack();
    } else {
        await resumeTrack();
    }
};
nextBtn.onclick = nextTrack;
prevBtn.onclick = prevTrack;
repeatBtn.onclick = async function() {
    await spotifyApi('me/player/repeat?state=context', 'PUT');
    getCurrentPlayback();
};
shuffleBtn.onclick = async function() {
    await spotifyApi('me/player/shuffle?state=true', 'PUT');
    getCurrentPlayback();
};

async function playTrack(uri) {
    await spotifyApi('me/player/play', 'PUT', { uris: [uri] });
    setTimeout(getCurrentPlayback, 700);
}
async function nextTrack() {
    await spotifyApi('me/player/next', 'POST');
    getCurrentPlayback();
}
async function prevTrack() {
    await spotifyApi('me/player/previous', 'POST');
    getCurrentPlayback();
}
async function pauseTrack() {
    await spotifyApi('me/player/pause', 'PUT');
    getCurrentPlayback();
}
async function resumeTrack() {
    await spotifyApi('me/player/play', 'PUT');
    getCurrentPlayback();
}

// Playback info
async function getCurrentPlayback() {
    const playback = await spotifyApi('me/player');
    if (!playback || !playback.item) return;
    document.getElementById('widget-track-name').textContent = playback.item.name;
    document.getElementById('widget-artist-name').textContent = playback.item.artists.map(a => a.name).join(', ');
    document.getElementById('widget-current-time').textContent = formatTime(playback.progress_ms);
    document.getElementById('widget-duration').textContent = formatTime(playback.item.duration_ms);
    document.getElementById('widget-track-name-main').textContent = playback.item.name;
    document.getElementById('widget-artist-name-main').textContent = playback.item.artists.map(a => a.name).join(', ');
    document.getElementById('widget-album-art').src = playback.item.album.images[0]?.url || '';
    document.getElementById('widget-player-main').style.display = 'block';
    isPlaying = playback.is_playing;
    const playIcon = playBtn.querySelector('i');
    if (isPlaying) {
        playIcon.classList.remove('fa-play');
        playIcon.classList.add('fa-pause');
    } else {
        playIcon.classList.remove('fa-pause');
        playIcon.classList.add('fa-play');
    }
}

function formatTime(ms) {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

// Song search functionality
const searchBtn = document.getElementById('widget-song-search-btn');
const searchInput = document.getElementById('widget-song-search-input');
searchBtn.onclick = searchSongs;
searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') searchSongs();
});

async function searchSongs() {
    const query = searchInput.value.trim();
    if (!query) return;
    const results = await spotifyApi(`search?q=${encodeURIComponent(query)}&type=track&limit=20`);
    const list = document.getElementById('widget-track-list');
    list.innerHTML = '';
    if (results.tracks && results.tracks.items.length > 0) {
        results.tracks.items.forEach(track => {
            const li = document.createElement('li');
            li.textContent = `${track.name} - ${track.artists.map(a => a.name).join(', ')}`;
            li.onclick = () => playTrack(track.uri);
            list.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = 'No results found.';
        list.appendChild(li);
    }
}

// Widget drag logic
const widget = document.getElementById('spotify-widget');
const header = document.querySelector('.widget-header');
let offsetX = 0, offsetY = 0, isDragging = false;

header.addEventListener('mousedown', function(e) {
    isDragging = true;
    offsetX = e.clientX - widget.offsetLeft;
    offsetY = e.clientY - widget.offsetTop;
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    widget.style.left = (e.clientX - offsetX) + 'px';
    widget.style.top = (e.clientY - offsetY) + 'px';
});

document.addEventListener('mouseup', function() {
    isDragging = false;
    document.body.style.userSelect = '';
});

// Close button
const closeBtn = document.getElementById('widget-close');
closeBtn.onclick = function() {
    widget.style.display = 'none';
};
