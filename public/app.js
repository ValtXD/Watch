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

let minhaSala = '';
let meuNome = '';
let minhaCor = '#00E5FF';
let minhaFoto = '';
let meuBanner = '';
let souHost = false;
let streamLocal;

const peers = {}; 
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// ==========================
// 1. CARREGAR PREFERÊNCIAS E SISTEMA DE CORTE (CROPPER)
// ==========================
// Trocado de localStorage para sessionStorage (apaga ao fechar a aba)
if (sessionStorage.getItem('nexus_nickname')) inputNome.value = sessionStorage.getItem('nexus_nickname');
if (sessionStorage.getItem('nexus_color')) inputCor.value = sessionStorage.getItem('nexus_color');

function salvarPreferencias() {
    meuNome = inputNome.value.trim() || 'OPERADOR';
    minhaCor = inputCor.value;
    sessionStorage.setItem('nexus_nickname', meuNome);
    sessionStorage.setItem('nexus_color', minhaCor);
}

// Elementos do Modal de Corte
const cropModal = document.getElementById('crop-modal');
const cropImage = document.getElementById('crop-image');
const btnConfirmCrop = document.getElementById('btn-confirm-crop');
const btnCancelCrop = document.getElementById('btn-cancel-crop');
const previewFoto = document.getElementById('preview-foto');
const previewBanner = document.getElementById('preview-banner');

let cropper;
let modoCorteAtual = ''; // 'foto' ou 'banner'

function iniciarCorte(file, modo) {
    const reader = new FileReader();
    reader.onload = (e) => {
        cropImage.src = e.target.result;
        cropModal.style.display = 'flex';
        modoCorteAtual = modo;

        // Configurações do Cropper baseadas no tipo de imagem
        let aspectRatio = modo === 'foto' ? 1 / 1 : 2.8 / 1; // 1:1 para avatar, 2.8:1 para banner
        
        if (modo === 'foto') {
            document.querySelector('.crop-container').classList.add('crop-circle');
        } else {
            document.querySelector('.crop-container').classList.remove('crop-circle');
        }

        if (cropper) cropper.destroy();
        
        cropper = new Cropper(cropImage, {
            aspectRatio: aspectRatio,
            viewMode: 1,
            dragMode: 'move',
            background: false,
        });
    };
    reader.readAsDataURL(file);
}

document.getElementById('input-foto').addEventListener('change', (e) => {
    if (e.target.files[0]) iniciarCorte(e.target.files[0], 'foto');
    e.target.value = ''; // Limpa o input
});

document.getElementById('input-banner').addEventListener('change', (e) => {
    if (e.target.files[0]) iniciarCorte(e.target.files[0], 'banner');
    e.target.value = '';
});

btnCancelCrop.onclick = () => {
    cropModal.style.display = 'none';
    if (cropper) cropper.destroy();
};

btnConfirmCrop.onclick = () => {
    if (!cropper) return;
    
    // Extrai a imagem cortada com qualidade controlada para não pesar a rede
    const canvas = cropper.getCroppedCanvas({
        width: modoCorteAtual === 'foto' ? 256 : 800,
        fillColor: '#000'
    });
    
    const base64Img = canvas.toDataURL('image/jpeg', 0.8);

    if (modoCorteAtual === 'foto') {
        minhaFoto = base64Img;
        previewFoto.src = base64Img;
    } else {
        meuBanner = base64Img;
        previewBanner.style.backgroundImage = `url(${base64Img})`;
    }

    cropModal.style.display = 'none';
    cropper.destroy();
};

// ==========================
// 2. LIGAÇÃO À REDE E SALAS (Abaixo deste ponto, o código original se mantém)
// ==========================

// ==========================
// 2. LIGAÇÃO À REDE E SALAS
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

// Fundo de Ecrã Local da Sala
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

// ==========================
// 3. CHAT E JANELA DE PERFIL
// ==========================
document.getElementById('btn-enviar-chat').onclick = enviarMsg;
inputChat.addEventListener('keypress', (e) => { if (e.key === 'Enter') enviarMsg(); });

function enviarMsg() {
    if (inputChat.value) {
        socket.emit('mensagemChat', { idSala: minhaSala, texto: inputChat.value });
        inputChat.value = '';
    }
}

const avatarPadrao = 'https://i.imgur.com/7A2y5Zz.png'; 

socket.on('mensagemChat', (dados) => {
    const div = document.createElement('div');
    div.className = 'msg';
    
    const fotoUser = dados.foto || avatarPadrao;
    const bannerUser = dados.banner || '';

    div.innerHTML = `
        <div class="msg-header" data-nome="${dados.nome}" data-cor="${dados.cor}" data-foto="${fotoUser}" data-banner="${bannerUser}">
            <img src="${fotoUser}" class="chat-avatar">
            <span class="msg-nome" style="color: ${dados.cor};">${dados.nome}</span>
        </div>
        <div class="msg-texto">${dados.texto}</div>
    `;
    
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Lógica do Hover (Rato por cima do nome/avatar)
    const header = div.querySelector('.msg-header');
    
    header.addEventListener('mouseenter', (e) => {
        const target = e.currentTarget;
        
        popupNome.innerText = target.getAttribute('data-nome');
        popupNome.style.color = target.getAttribute('data-cor');
        popupFoto.src = target.getAttribute('data-foto');
        
        const bannerStr = target.getAttribute('data-banner');
        popupBanner.style.backgroundImage = bannerStr ? `url(${bannerStr})` : 'none';
        
        profilePopup.style.display = 'block';
        const rect = target.getBoundingClientRect();
        
        profilePopup.style.left = (rect.left - 270) + 'px'; 
        profilePopup.style.top = (rect.top - 50) + 'px';
        
        if (rect.left < 270) {
            profilePopup.style.left = (rect.right + 10) + 'px';
        }
    });

    header.addEventListener('mouseleave', () => {
        profilePopup.style.display = 'none';
    });
});

// ==========================
// 4. WEBRTC (TRANSMISSÃO DE ÁUDIO E VÍDEO)
// ==========================
let micLigado = false;
let meuTrackDeAudio = null;

document.getElementById('btn-mic').onclick = async () => {
    const btnMic = document.getElementById('btn-mic');
    
    // Se for a primeira vez que clica, pedimos permissão e capturamos o áudio
    if (!meuTrackDeAudio) {
        try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            meuTrackDeAudio = audioStream.getAudioTracks()[0]; // Salva o controle do microfone
            adicionarStreamAsConexoes(audioStream);
            
            micLigado = true;
            btnMic.style.backgroundColor = '#00E5FF'; 
            btnMic.style.color = '#000'; 
            btnMic.innerText = 'MIC ON';
        } catch (e) { 
            alert("Acesso ao microfone negado ou indisponível."); 
        }
    } else {
        // Se já tem o microfone capturado, apenas Liga/Desliga (Mute)
        micLigado = !micLigado;
        meuTrackDeAudio.enabled = micLigado; // Corta o som na fonte
        
        if (micLigado) {
            btnMic.style.backgroundColor = '#00E5FF'; 
            btnMic.style.color = '#000'; 
            btnMic.innerText = 'MIC ON';
        } else {
            btnMic.style.backgroundColor = 'rgba(0, 229, 255, 0.1)'; 
            btnMic.style.color = '#00E5FF'; 
            btnMic.innerText = 'MIC OFF';
        }
    }
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
        btnTela.innerText = 'A TRANSMITIR';
        
        if (document.pictureInPictureEnabled) {
            try { await videoLocal.requestPictureInPicture(); } catch (e) { console.log("PiP automático falhou"); }
        }
    } catch (e) { console.log("Partilha cancelada"); }
};

function adicionarStreamAsConexoes(novoStream) {
    if (!streamLocal) {
        streamLocal = novoStream;
    } else {
        novoStream.getTracks().forEach(track => streamLocal.addTrack(track));
    }

    for (const socketId in peers) {
        const pc = peers[socketId];
        novoStream.getTracks().forEach(track => {
            if (!pc.getSenders().find(s => s.track === track)) {
                pc.addTrack(track, streamLocal);
            }
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

socket.on('webrtc_answer', async (dados) => {
    if (peers[dados.remetente]) {
        await peers[dados.remetente].setRemoteDescription(new RTCSessionDescription(dados.sdp));
    }
});

socket.on('webrtc_ice_candidate', async (dados) => {
    if (peers[dados.remetente]) {
        await peers[dados.remetente].addIceCandidate(new RTCIceCandidate(dados.candidato));
    }
});

function criarPeerConnection(idAlvo) {
    const pc = new RTCPeerConnection(rtcConfig);
    peers[idAlvo] = pc;

    pc.onicecandidate = (evento) => {
        if (evento.candidate) {
            socket.emit('webrtc_ice_candidate', { alvo: idAlvo, candidato: evento.candidate });
        }
    };

    pc.ontrack = (evento) => {
        videoRemoto.srcObject = evento.streams[0];
        document.getElementById('no-video-msg').style.display = 'none';
    };

    pc.onnegotiationneeded = async () => {
        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('webrtc_offer', { alvo: idAlvo, sdp: offer });
        } catch (err) {
            console.error(err);
        }
    };

    if (streamLocal) {
        streamLocal.getTracks().forEach(track => pc.addTrack(track, streamLocal));
    }

    return pc;
}

// ==========================
// 5. CONTROLE DE VOLUME LOCAL
// ==========================
const inputVolume = document.getElementById('input-volume');
const volumeIcon = document.getElementById('volume-icon');

inputVolume.addEventListener('input', (e) => {
    // Pega o valor da barra (vai de 0.0 até 1.0)
    const vol = parseFloat(e.target.value);
    
    // Altera o volume apenas do vídeo remoto no PC desta pessoa
    videoRemoto.volume = vol;
    
    // Muda o ícone dependendo do nível do volume
    if (vol === 0) {
        volumeIcon.innerText = '🔇';
    } else if (vol < 0.5) {
        volumeIcon.innerText = '🔉';
    } else {
        volumeIcon.innerText = '🔊';
    }
});

// Ação do Botão de Remover Fundo
document.getElementById('btn-remover-fundo').onclick = () => {
    videoContainer.style.backgroundImage = 'none';
    document.getElementById('input-wallpaper').value = '';
};

// Escutar mensagens de histórico (Entrou/Saiu)
socket.on('sistemaMsg', (dados) => {
    const div = document.createElement('div');
    div.className = 'msg-sistema';
    div.innerHTML = `<span class="sys-name" style="color: ${dados.cor};">${dados.nome}</span> ${dados.texto}`;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
});