const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Aumentamos o limite do buffer para permitir o envio de imagens base64 pesadas
const io = new Server(server, {
    maxHttpBufferSize: 1e8 // Permite pacotes de até 100MB
});

// Serve os ficheiros da pasta 'public'
app.use(express.static('public'));

const salas = {}; // Estrutura: { idSala: { senha, host, usuarios: { socketId: { nome, cor, foto, banner } } } }

io.on('connection', (socket) => {
    // Criar Sala
    socket.on('criarSala', ({ nome, cor, foto, banner }) => {
        const idSala = Math.random().toString(36).substring(2, 8).toUpperCase();
        const senha = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        salas[idSala] = { 
            senha: senha, 
            host: socket.id, 
            usuarios: { [socket.id]: { nome, cor, foto, banner } } 
        };
        socket.join(idSala);
        socket.emit('salaCriada', { idSala, senha, isHost: true, nome, cor });
    });

    // Entrar na Sala
    socket.on('entrarSala', ({ idSala, senha, nome, cor, foto, banner }) => {
        if (salas[idSala] && salas[idSala].senha === senha) {
            salas[idSala].usuarios[socket.id] = { nome, cor, foto, banner };
            socket.join(idSala);
            socket.emit('entrouComSucesso', { idSala, isHost: false, nome, cor });
            
            // Avisa quem já está na rede que alguém novo conectou
            socket.to(idSala).emit('novoUsuario', { id: socket.id, nome: nome });
            
            // MENSAGEM DE HISTÓRICO: Usuário entrou
            io.to(idSala).emit('sistemaMsg', { nome: nome, cor: cor, texto: 'conectou-se à rede.' });
        } else {
            socket.emit('erro', 'Sala ou chave incorretos!');
        }
    });

    socket.on('mensagemChat', (dados) => {
        const user = salas[dados.idSala]?.usuarios[socket.id] || { nome: "Anônimo", cor: "#00E5FF", foto: "", banner: "" };
        io.to(dados.idSala).emit('mensagemChat', { 
            nome: user.nome, cor: user.cor, foto: user.foto, banner: user.banner, texto: dados.texto 
        });
    });

    socket.on('webrtc_offer', (dados) => socket.to(dados.alvo).emit('webrtc_offer', { sdp: dados.sdp, remetente: socket.id }));
    socket.on('webrtc_answer', (dados) => socket.to(dados.alvo).emit('webrtc_answer', { sdp: dados.sdp, remetente: socket.id }));
    socket.on('webrtc_ice_candidate', (dados) => socket.to(dados.alvo).emit('webrtc_ice_candidate', { candidato: dados.candidato, remetente: socket.id }));

    // MENSAGEM DE HISTÓRICO: Usuário saiu
    socket.on('disconnect', () => {
        for (const sala in salas) {
            if (salas[sala].usuarios[socket.id]) {
                const user = salas[sala].usuarios[socket.id];
                io.to(sala).emit('sistemaMsg', { nome: user.nome, cor: user.cor, texto: 'desconectou-se da rede.' });
                delete salas[sala].usuarios[socket.id];
               }
          }
        });

    // Chat de Texto com envio dos dados de Perfil
    socket.on('mensagemChat', (dados) => {
        const user = salas[dados.idSala]?.usuarios[socket.id] || { nome: "Anônimo", cor: "#00E5FF", foto: "", banner: "" };
        
        io.to(dados.idSala).emit('mensagemChat', { 
            nome: user.nome, 
            cor: user.cor, 
            foto: user.foto, 
            banner: user.banner, 
            texto: dados.texto 
        });
    });

    // --- Sinalização WebRTC (P2P de Vídeo e Áudio) ---
    socket.on('webrtc_offer', (dados) => {
        socket.to(dados.alvo).emit('webrtc_offer', { sdp: dados.sdp, remetente: socket.id });
    });
    
    socket.on('webrtc_answer', (dados) => {
        socket.to(dados.alvo).emit('webrtc_answer', { sdp: dados.sdp, remetente: socket.id });
    });
    
    socket.on('webrtc_ice_candidate', (dados) => {
        socket.to(dados.alvo).emit('webrtc_ice_candidate', { candidato: dados.candidato, remetente: socket.id });
    });

    // Limpeza ao Desconectar
    socket.on('disconnect', () => {
        for (const sala in salas) {
            if (salas[sala].usuarios[socket.id]) {
                delete salas[sala].usuarios[socket.id];
            }
        }
    });
});

// A porta é definida pelo host em nuvem (Render) ou 3000 em testes locais
const PORTA = process.env.PORT || 3000;
server.listen(PORTA, () => {
    console.log(`Servidor a correr na porta ${PORTA}`);
});