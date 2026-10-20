const socket = io();

const loginScreen = document.getElementById('login-screen');
const roomScreen = document.getElementById('room-screen');
const inputNome = document.getElementById('input-nome');
const inputCor = document.getElementById('input-cor');
const inputWallpaper = document.getElementById('input-wallpaper');
const videoContainer = document.getElementById('video-container');
const videoLocal = document.getElementById('video-local');
const videoRemoto = document.getElementById('video-remoto');
const chatBox = document.getElementById('chat-box');
const inputChat = document.getElementById('input-chat');
const btnTela = document.getElementById('btn-tela');

const profilePopup = document.getElementById('profile-popup');
const popupBanner = document.getElementById('popup-banner');
const popupFoto = document.getElementById('popup-foto');
const popupNome = document.getElementById('popup-nome');

let minhaSala = '', meuNome = '', minhaCor = '#00E5FF', minhaFoto = '', meuBanner = '', souHost = false;
let streamLocal = new MediaStream();

const peers = {}; 
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// ==========================
// MÚSICA DE FUNDO DO LOGIN
// ==========================
const bgAudio = document.getElementById('bg-audio');
const btnMusic = document.getElementById('btn-music');

btnMusic.onclick = () => {
    if (bgAudio.paused) {
        bgAudio.volume = 0.25; // Define o volume para 25% (para não ser muito alto)
        bgAudio.play();
        btnMusic.innerText = 'MÚSICA ON';
        btnMusic.style.backgroundColor = '#00E5FF';
        btnMusic.style.color = '#000';
    } else {
        bgAudio.pause();
        btnMusic.innerText = 'MÚSICA OFF';
        btnMusic.style.backgroundColor = 'rgba(0, 20, 40, 0.8)';
        btnMusic.style.color = '#00E5FF';
    }
};

// ==========================
// CRÉDITOS DO PROJETO
// ==========================
const btnCredits = document.getElementById('btn-credits');
const creditsModal = document.getElementById('credits-modal');
const btnCloseCredits = document.getElementById('btn-close-credits');

btnCredits.onclick = () => {
    creditsModal.style.display = 'flex';
};

btnCloseCredits.onclick = () => {
    creditsModal.style.display = 'none';
};

// ==========================
// 1. CARREGAR PREFERÊNCIAS E RECONEXÃO
// ==========================
if (localStorage.getItem('nexus_nickname')) inputNome.value = localStorage.getItem('nexus_nickname');
if (localStorage.getItem('nexus_color')) inputCor.value = localStorage.getItem('nexus_color');
if (localStorage.getItem('nexus_foto')) { minhaFoto = localStorage.getItem('nexus_foto'); document.getElementById('preview-foto').src = minhaFoto; }
if (localStorage.getItem('nexus_banner')) { meuBanner = localStorage.getItem('nexus_banner'); document.getElementById('preview-banner').style.backgroundImage = `url(${meuBanner})`; }

function salvarPreferencias() {
    meuNome = inputNome.value.trim() || 'OPERADOR';
    minhaCor = inputCor.value;
    localStorage.setItem('nexus_nickname', meuNome);
    localStorage.setItem('nexus_color', minhaCor);
    localStorage.setItem('nexus_foto', minhaFoto);
    localStorage.setItem('nexus_banner', meuBanner);
}

// Contador Online Global
socket.on('contadorOnline', (count) => {
    const counterEl = document.getElementById('online-count');
    if (counterEl) counterEl.innerText = count;
});

// Reconexão Automática
socket.on('connect', () => {
    const savedRoom = sessionStorage.getItem('nexus_idSala');
    const savedPwd = sessionStorage.getItem('nexus_senha');
    if (savedRoom && savedPwd) {
        salvarPreferencias();
        socket.emit('entrarSala', { 
            idSala: savedRoom, senha: savedPwd, nome: meuNome, cor: minhaCor, 
            foto: minhaFoto, banner: meuBanner, reconnect: true 
        });
    }
});

// CROPPER E CORTES
const cropModal = document.getElementById('crop-modal');
const cropImage = document.getElementById('crop-image');
const btnConfirmCrop = document.getElementById('btn-confirm-crop');
const btnCancelCrop = document.getElementById('btn-cancel-crop');
const previewFoto = document.getElementById('preview-foto');
const previewBanner = document.getElementById('preview-banner');
let cropper, modoCorteAtual = ''; 

function iniciarCorte(file, modo) {
    const reader = new FileReader();
    reader.onload = (e) => {
        cropImage.src = e.target.result; cropModal.style.display = 'flex'; modoCorteAtual = modo;
        let aspectRatio = modo === 'foto' ? 1 / 1 : 2.8 / 1; 
        if (modo === 'foto') document.querySelector('.crop-container').classList.add('crop-circle'); 
        else document.querySelector('.crop-container').classList.remove('crop-circle');
        if (cropper) cropper.destroy();
        cropper = new Cropper(cropImage, { aspectRatio: aspectRatio, viewMode: 1, dragMode: 'move', background: false });
    };
    reader.readAsDataURL(file);
}
document.getElementById('input-foto').addEventListener('change', (e) => { if (e.target.files[0]) iniciarCorte(e.target.files[0], 'foto'); e.target.value = ''; });
document.getElementById('input-banner').addEventListener('change', (e) => { if (e.target.files[0]) iniciarCorte(e.target.files[0], 'banner'); e.target.value = ''; });
btnCancelCrop.onclick = () => { cropModal.style.display = 'none'; if (cropper) cropper.destroy(); };

btnConfirmCrop.onclick = () => {
    if (!cropper) return;
    const canvas = cropper.getCroppedCanvas({ width: modoCorteAtual === 'foto' ? 256 : 800, fillColor: '#000' });
    const base64Img = canvas.toDataURL('image/jpeg', 0.8);
    if (modoCorteAtual === 'foto') { minhaFoto = base64Img; previewFoto.src = base64Img; } 
    else { meuBanner = base64Img; previewBanner.style.backgroundImage = `url(${base64Img})`; }
    cropModal.style.display = 'none'; cropper.destroy();
};

// ==========================
// 2. LIGAÇÃO À REDE E INTERFACE
// ==========================
document.getElementById('btn-criar').onclick = () => {
    salvarPreferencias();
    socket.emit('criarSala', { nome: meuNome, cor: minhaCor, foto: minhaFoto, banner: meuBanner });
};
document.getElementById('btn-entrar').onclick = () => {
    salvarPreferencias();
    const id = document.getElementById('input-sala').value.toUpperCase();
    const pwd = document.getElementById('input-senha').value.toUpperCase();
    socket.emit('entrarSala', { idSala: id, senha: pwd, nome: meuNome, cor: minhaCor, foto: minhaFoto, banner: meuBanner });
};

socket.on('salaCriada', (dados) => { souHost = true; btnTela.style.display = 'block'; entrarNaInterface(dados.idSala, dados.senha); });
socket.on('entrouComSucesso', (dados) => { souHost = dados.isHost; if(souHost) btnTela.style.display = 'block'; entrarNaInterface(dados.idSala, 'OCULTA'); });
socket.on('erro', (msg) => { sessionStorage.clear(); alert(msg); });

function entrarNaInterface(id, senha) {
    minhaSala = id;
    sessionStorage.setItem('nexus_idSala', id);
    sessionStorage.setItem('nexus_senha', senha);
// === CÓDIGO CORRIGIDO: PÁRA A MÚSICA AO ENTRAR NA SALA ===
    if (bgAudio) {
        bgAudio.pause();
        bgAudio.currentTime = 0; // Volta a música para o início caso saia e volte
    }
    loginScreen.style.display = 'none';
    roomScreen.style.display = 'flex';
    document.getElementById('room-info').innerText = `REDE: ${id} | CHAVE: ${senha}`;
}

document.getElementById('btn-sair').onclick = () => {
    sessionStorage.clear();
    location.reload();
};

inputWallpaper.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) { const reader = new FileReader(); reader.onload = (e) => videoContainer.style.backgroundImage = `url(${e.target.result})`; reader.readAsDataURL(file); }
});
document.getElementById('btn-remover-fundo').onclick = () => { videoContainer.style.backgroundImage = 'none'; document.getElementById('input-wallpaper').value = ''; };

// ==========================
// 3. CHAT E JANELA DE PERFIL
// ==========================
document.getElementById('btn-enviar-chat').onclick = enviarMsg;
inputChat.addEventListener('keypress', (e) => { if (e.key === 'Enter') enviarMsg(); });

function enviarMsg() { if (inputChat.value) { socket.emit('mensagemChat', { idSala: minhaSala, texto: inputChat.value }); inputChat.value = ''; } }

socket.on('mensagemChat', (dados) => {
    const div = document.createElement('div'); div.className = 'msg';
    const fotoUser = dados.foto || 'https://i.imgur.com/7A2y5Zz.png';
    div.innerHTML = `
        <div class="msg-header" data-nome="${dados.nome}" data-cor="${dados.cor}" data-foto="${fotoUser}" data-banner="${dados.banner || ''}">
            <img src="${fotoUser}" class="chat-avatar">
            <span class="msg-nome" style="color: ${dados.cor};">${dados.nome}</span>
        </div>
        <div class="msg-texto">${dados.texto}</div>
    `;
    chatBox.appendChild(div); chatBox.scrollTop = chatBox.scrollHeight;

    const header = div.querySelector('.msg-header');
    header.addEventListener('mouseenter', (e) => {
        const target = e.currentTarget;
        popupNome.innerText = target.getAttribute('data-nome'); popupNome.style.color = target.getAttribute('data-cor');
        popupFoto.src = target.getAttribute('data-foto');
        const bannerStr = target.getAttribute('data-banner'); popupBanner.style.backgroundImage = bannerStr ? `url(${bannerStr})` : 'none';
        profilePopup.style.display = 'block'; const rect = target.getBoundingClientRect();
        profilePopup.style.left = (rect.left - 270) + 'px'; profilePopup.style.top = (rect.top - 50) + 'px';
        if (rect.left < 270) profilePopup.style.left = (rect.right + 10) + 'px';
    });
    header.addEventListener('mouseleave', () => profilePopup.style.display = 'none');
});

socket.on('sistemaMsg', (dados) => {
    const div = document.createElement('div'); div.className = 'msg-sistema';
    div.innerHTML = `<span class="sys-name" style="color: ${dados.cor};">${dados.nome}</span> ${dados.texto}`;
    chatBox.appendChild(div); chatBox.scrollTop = chatBox.scrollHeight;
});

// ==========================
// 4. WEBRTC & ÁUDIO NATIVO
// ==========================
let micLigado = false, meuTrackDeAudio = null;

document.getElementById('btn-mic').onclick = async () => {
    const btnMic = document.getElementById('btn-mic');
    if (!meuTrackDeAudio) {
        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            meuTrackDeAudio = audioStream.getAudioTracks()[0];
            streamLocal.addTrack(meuTrackDeAudio);
            atualizarTracksNosPeers();
            micLigado = true;
            btnMic.style.backgroundColor = '#00E5FF'; btnMic.style.color = '#000'; btnMic.innerText = 'MIC ON';
        } catch (e) { alert("Mic negado ou indisponível."); }
    } else {
        micLigado = !micLigado; meuTrackDeAudio.enabled = micLigado;
        if (micLigado) { btnMic.style.backgroundColor = '#00E5FF'; btnMic.style.color = '#000'; btnMic.innerText = 'MIC ON'; } 
        else { btnMic.style.backgroundColor = 'rgba(0, 229, 255, 0.1)'; btnMic.style.color = '#00E5FF'; btnMic.innerText = 'MIC OFF'; }
    }
};

btnTela.onclick = async () => {
    try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        videoLocal.srcObject = displayStream; videoLocal.style.display = 'block';
        document.getElementById('no-video-msg').style.display = 'none'; videoRemoto.style.display = 'none';
        
        displayStream.getTracks().forEach(track => streamLocal.addTrack(track));
        atualizarTracksNosPeers();
        btnTela.style.backgroundColor = '#00E5FF'; btnTela.style.color = '#000'; btnTela.innerText = 'A TRANSMITIR';
    } catch (e) { console.log("Partilha cancelada"); }
};

function atualizarTracksNosPeers() {
    for (const socketId in peers) {
        streamLocal.getTracks().forEach(track => {
            if (!peers[socketId].getSenders().find(s => s.track === track)) peers[socketId].addTrack(track, streamLocal);
        });
    }
}

socket.on('novoUsuario', async (dados) => {
    const pc = criarPeerConnection(dados.id);
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    socket.emit('webrtc_offer', { alvo: dados.id, sdp: offer });
});

socket.on('webrtc_offer', async (dados) => {
    const pc = criarPeerConnection(dados.remetente);
    await pc.setRemoteDescription(new RTCSessionDescription(dados.sdp));
    const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
    socket.emit('webrtc_answer', { alvo: dados.remetente, sdp: answer });
});

socket.on('webrtc_answer', async (dados) => { if (peers[dados.remetente]) await peers[dados.remetente].setRemoteDescription(new RTCSessionDescription(dados.sdp)); });
socket.on('webrtc_ice_candidate', async (dados) => { if (peers[dados.remetente]) await peers[dados.remetente].addIceCandidate(new RTCIceCandidate(dados.candidato)); });

function criarPeerConnection(idAlvo) {
    if (peers[idAlvo]) return peers[idAlvo]; 
    const pc = new RTCPeerConnection(rtcConfig);
    peers[idAlvo] = pc;

    pc.onicecandidate = (evento) => { if (evento.candidate) socket.emit('webrtc_ice_candidate', { alvo: idAlvo, candidato: evento.candidate }); };

    pc.ontrack = (evento) => {
        const track = evento.track;
        
        if (track.kind === 'video') {
            videoRemoto.srcObject = new MediaStream([track]);
            document.getElementById('no-video-msg').style.display = 'none';
        } else if (track.kind === 'audio') {
            let audioElem = document.getElementById(`audio-${idAlvo}`);
            if (!audioElem) {
                audioElem = document.createElement('audio');
                audioElem.id = `audio-${idAlvo}`;
                audioElem.autoplay = true;
                
                const slider = document.getElementById(`vol-${idAlvo}`);
                audioElem.volume = slider ? parseFloat(slider.value) : 1.0;
                document.body.appendChild(audioElem);
            }
            if (audioElem.srcObject) audioElem.srcObject.addTrack(track);
            else audioElem.srcObject = new MediaStream([track]);
            
            audioElem.play().catch(e => console.log('A aguardar interação para iniciar áudio.'));
        }
    };

    pc.onnegotiationneeded = async () => {
        try { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); socket.emit('webrtc_offer', { alvo: idAlvo, sdp: offer }); } catch (err) {}
    };

    streamLocal.getTracks().forEach(track => pc.addTrack(track, streamLocal));
    return pc;
}

// ==========================
// 5. CONTROLO DE VOLUMES NA INTERFACE
// ==========================
const inputVolumeMaster = document.getElementById('input-volume');
const volumeIcon = document.getElementById('volume-icon');

inputVolumeMaster.addEventListener('input', (e) => {
    const vol = parseFloat(e.target.value);
    videoRemoto.volume = vol; 
    if (vol === 0) volumeIcon.innerText = '🔇';
    else if (vol < 0.5) volumeIcon.innerText = '🔉';
    else volumeIcon.innerText = '🔊';
});

socket.on('listaUsuarios', (usuarios) => {
    const list = document.getElementById('participants-list');
    list.innerHTML = '';
    for (const [sid, user] of Object.entries(usuarios)) {
        if (sid === socket.id) continue;
        
        const audioExistente = document.getElementById(`audio-${sid}`);
        const volAtual = audioExistente ? audioExistente.volume : 1.0;

        const div = document.createElement('div');
        div.className = 'participant-item';
        div.innerHTML = `
            <span class="participant-name" style="color: ${user.cor}">${user.nome}</span>
            <input type="range" class="participant-vol-slider" id="vol-${sid}" min="0" max="1" step="0.05" value="${volAtual}" title="Volume: ${Math.round(volAtual*100)}%">
        `;
        list.appendChild(div);

        const slider = div.querySelector('input');
        slider.addEventListener('input', (e) => {
            const vol = parseFloat(e.target.value);
            e.target.title = `Volume: ${Math.round(vol * 100)}%`;
            const audioDaPessoa = document.getElementById(`audio-${sid}`);
            if (audioDaPessoa) audioDaPessoa.volume = vol;
        });
    }
});