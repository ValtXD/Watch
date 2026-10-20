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

let minhaSala = '', meuNome = '', minhaCor = '#00E5FF', souHost = false, streamLocal;
const peers = {}; 
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Carregar preferências salvas
if (localStorage.getItem('nexus_nickname')) inputNome.value = localStorage.getItem('nexus_nickname');
if (localStorage.getItem('nexus_color')) inputCor.value = localStorage.getItem('nexus_color');

function salvarPreferencias() {
    meuNome = inputNome.value.trim() || 'OPERADOR';
    minhaCor = inputCor.value;
    localStorage.setItem('nexus_nickname', meuNome);
    localStorage.setItem('nexus_color', minhaCor);
}

// Upload de Fundo de Tela Local
inputWallpaper.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            videoContainer.style.backgroundImage = `url(${e.target.result})`;
        };
        reader.readAsDataURL(file);
    }
});

document.getElementById('btn-criar').onclick = () => {
    salvarPreferencias();
    socket.emit('criarSala', { nome: meuNome, cor: minhaCor });
};

document.getElementById('btn-entrar').onclick = () => {
    salvarPreferencias();
    const id = document.getElementById('input-sala').value.toUpperCase();
    const pwd = document.getElementById('input-senha').value.toUpperCase();
    socket.emit('entrarSala', { idSala: id, senha: pwd, nome: meuNome, cor: minhaCor });
};

socket.on('salaCriada', (dados) => {
    souHost = true;
    btnTela.style.display = 'block';
    entrarNaInterface(dados.idSala, dados.senha);
});

socket.on('entrouComSucesso', (dados) => {
    souHost = false;
    entrarNaInterface(dados.idSala, 'OCULTA');
});

socket.on('erro', (msg) => alert(msg));

function entrarNaInterface(id, senha) {
    minhaSala = id;
    loginScreen.style.display = 'none';
    roomScreen.style.display = 'flex';
    document.getElementById('room-info').innerText = `REDE: ${id} | CHAVE: ${senha}`;
}

document.getElementById('btn-enviar-chat').onclick = enviarMsg;
inputChat.addEventListener('keypress', (e) => { if (e.key === 'Enter') enviarMsg(); });

function enviarMsg() {
    if (inputChat.value) {
        socket.emit('mensagemChat', { idSala: minhaSala, texto: inputChat.value });
        inputChat.value = '';
    }
}

socket.on('mensagemChat', (dados) => {
    const div = document.createElement('div');
    div.className = 'msg';
    div.innerHTML = `<span class="msg-nome" style="color: ${dados.cor};">${dados.nome}:</span> ${dados.texto}`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
});

// WEBRTC E MÍDIA
document.getElementById('btn-mic').onclick = async () => {
    try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        adicionarStreamAsConexoes(audioStream);
        document.getElementById('btn-mic').style.backgroundColor = '#00E5FF'; 
        document.getElementById('btn-mic').style.color = '#000'; 
    } catch (e) { alert("Mic bloqueado"); }
};

btnTela.onclick = async () => {
    try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        videoLocal.srcObject = displayStream;
        videoLocal.style.display = 'block';
        document.getElementById('no-video-msg').style.display = 'none';
        videoRemoto.style.display = 'none';
        adicionarStreamAsConexoes(displayStream);
        btnTela.style.backgroundColor = '#00E5FF';
        btnTela.style.color = '#000';
        btnTela.innerText = 'TRANSMITINDO';
        if (document.pictureInPictureEnabled) {
            try { await videoLocal.requestPictureInPicture(); } catch (e) {}
        }
    } catch (e) {}
};

function adicionarStreamAsConexoes(novoStream) {
    if (!streamLocal) streamLocal = novoStream;
    else novoStream.getTracks().forEach(track => streamLocal.addTrack(track));
    for (const socketId in peers) {
        const pc = peers[socketId];
        novoStream.getTracks().forEach(track => {
            if (!pc.getSenders().find(s => s.track === track)) pc.addTrack(track, streamLocal);
        });
    }
}

socket.on('novoUsuario', async (dados) => {
    const pc = criarPeerConnection(dados.id);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('webrtc_offer', { alvo: dados.id, sdp: offer });
});

socket.on('webrtc_offer', async (dados) => {
    const pc = criarPeerConnection(dados.remetente);
    await pc.setRemoteDescription(new RTCSessionDescription(dados.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('webrtc_answer', { alvo: dados.remetente, sdp: answer });
});

socket.on('webrtc_answer', async (dados) => { if (peers[dados.remetente]) await peers[dados.remetente].setRemoteDescription(new RTCSessionDescription(dados.sdp)); });
socket.on('webrtc_ice_candidate', async (dados) => { if (peers[dados.remetente]) await peers[dados.remetente].addIceCandidate(new RTCIceCandidate(dados.candidato)); });

function criarPeerConnection(idAlvo) {
    const pc = new RTCPeerConnection(rtcConfig);
    peers[idAlvo] = pc;
    pc.onicecandidate = (evento) => { if (evento.candidate) socket.emit('webrtc_ice_candidate', { alvo: idAlvo, candidato: evento.candidate }); };
    pc.ontrack = (evento) => {
        videoRemoto.srcObject = evento.streams[0];
        document.getElementById('no-video-msg').style.display = 'none';
    };
    pc.onnegotiationneeded = async () => {
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('webrtc_offer', { alvo: idAlvo, sdp: offer });
        } catch (err) {}
    };
    if (streamLocal) streamLocal.getTracks().forEach(track => pc.addTrack(track, streamLocal));
    return pc;
}