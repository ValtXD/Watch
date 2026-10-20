const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Limite aumentado para permitir o envio de imagens em Base64
const io = new Server(server, { maxHttpBufferSize: 1e8 });
app.use(express.static('public'));

const salas = {}; 

// Função para avisar todos sobre quantas pessoas estão no site
function emitirContadorGlobal() {
    io.emit('contadorOnline', io.engine.clientsCount);
}

io.on('connection', (socket) => {
    emitirContadorGlobal(); // Atualiza quando alguém abre o site

    const enviarListaUsuarios = (idSala) => {
        if(salas[idSala]) io.to(idSala).emit('listaUsuarios', salas[idSala].usuarios);
    };

    socket.on('criarSala', ({ nome, cor, foto, banner }) => {
        const idSala = Math.random().toString(36).substring(2, 8).toUpperCase();
        const senha = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        salas[idSala] = { 
            senha, 
            host: socket.id, 
            usuarios: { [socket.id]: { id: socket.id, nome, cor, foto, banner, isHost: true } } 
        };
        socket.join(idSala);
        socket.emit('salaCriada', { idSala, senha, isHost: true, nome, cor });
        enviarListaUsuarios(idSala);
    });

    socket.on('entrarSala', ({ idSala, senha, nome, cor, foto, banner, reconnect }) => {
        if (salas[idSala] && salas[idSala].senha === senha) {
            salas[idSala].usuarios[socket.id] = { id: socket.id, nome, cor, foto, banner, isHost: false };
            socket.join(idSala);
            socket.emit('entrouComSucesso', { idSala, isHost: false, nome, cor });
            socket.to(idSala).emit('novoUsuario', { id: socket.id, nome: nome });
            
            if(!reconnect) {
                io.to(idSala).emit('sistemaMsg', { nome, cor, texto: 'conectou-se à rede.' });
            }
            enviarListaUsuarios(idSala);
        } else {
            socket.emit('erro', 'Sala ou chave incorretos (ou a sala expirou)!');
        }
    });

    socket.on('mensagemChat', (dados) => {
        const user = salas[dados.idSala]?.usuarios[socket.id] || { nome: "Anônimo", cor: "#00E5FF", foto: "", banner: "" };
        io.to(dados.idSala).emit('mensagemChat', { nome: user.nome, cor: user.cor, foto: user.foto, banner: user.banner, texto: dados.texto });
    });

    socket.on('webrtc_offer', (dados) => socket.to(dados.alvo).emit('webrtc_offer', { sdp: dados.sdp, remetente: socket.id }));
    socket.on('webrtc_answer', (dados) => socket.to(dados.alvo).emit('webrtc_answer', { sdp: dados.sdp, remetente: socket.id }));
    socket.on('webrtc_ice_candidate', (dados) => socket.to(dados.alvo).emit('webrtc_ice_candidate', { candidato: dados.candidato, remetente: socket.id }));

    socket.on('disconnect', () => {
        setTimeout(emitirContadorGlobal, 100); // Atualiza o contador quando alguém sai
        for (const sala in salas) {
            if (salas[sala].usuarios[socket.id]) {
                const user = salas[sala].usuarios[socket.id];
                io.to(sala).emit('sistemaMsg', { nome: user.nome, cor: user.cor, texto: 'desconectou-se da rede.' });
                delete salas[sala].usuarios[socket.id];
                enviarListaUsuarios(sala);
                
                // Remove salas vazias após 10 segundos
                if(Object.keys(salas[sala].usuarios).length === 0) {
                    setTimeout(() => { 
                        if(salas[sala] && Object.keys(salas[sala].usuarios).length === 0) delete salas[sala]; 
                    }, 10000); 
                }
            }
        }
    });
});

const PORTA = process.env.PORT || 3000;
server.listen(PORTA, () => console.log(`Servidor a correr na porta ${PORTA}`));