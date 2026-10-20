const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const salas = {}; 

io.on('connection', (socket) => {
    socket.on('criarSala', ({ nome, cor }) => {
        const idSala = Math.random().toString(36).substring(2, 8).toUpperCase();
        const senha = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        salas[idSala] = { 
            senha: senha, 
            host: socket.id, 
            usuarios: { [socket.id]: { nome, cor } } 
        };
        socket.join(idSala);
        socket.emit('salaCriada', { idSala, senha, isHost: true, nome, cor });
    });

    socket.on('entrarSala', ({ idSala, senha, nome, cor }) => {
        if (salas[idSala] && salas[idSala].senha === senha) {
            salas[idSala].usuarios[socket.id] = { nome, cor };
            socket.join(idSala);
            socket.emit('entrouComSucesso', { idSala, isHost: false, nome, cor });
            socket.to(idSala).emit('novoUsuario', { id: socket.id, nome: nome });
        } else {
            socket.emit('erro', 'Sala ou senha incorretos!');
        }
    });

    socket.on('mensagemChat', (dados) => {
        const user = salas[dados.idSala]?.usuarios[socket.id] || { nome: "Anônimo", cor: "#00E5FF" };
        io.to(dados.idSala).emit('mensagemChat', { nome: user.nome, cor: user.cor, texto: dados.texto });
    });

    socket.on('webrtc_offer', (dados) => socket.to(dados.alvo).emit('webrtc_offer', { sdp: dados.sdp, remetente: socket.id }));
    socket.on('webrtc_answer', (dados) => socket.to(dados.alvo).emit('webrtc_answer', { sdp: dados.sdp, remetente: socket.id }));
    socket.on('webrtc_ice_candidate', (dados) => socket.to(dados.alvo).emit('webrtc_ice_candidate', { candidato: dados.candidato, remetente: socket.id }));

    socket.on('disconnect', () => {
        for (const sala in salas) {
            if (salas[sala].usuarios[socket.id]) delete salas[sala].usuarios[socket.id];
        }
    });
});

// A porta fornecida pelo host em nuvem ou 3000 localmente
const PORTA = process.env.PORT || 3000;
server.listen(PORTA, () => console.log(`Servidor rodando na porta ${PORTA}`));