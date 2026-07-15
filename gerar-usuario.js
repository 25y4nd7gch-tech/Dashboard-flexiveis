// Script auxiliar para criar/gerar credenciais de novos usuários.
// Uso: node gerar-usuario.js NOME_USUARIO SENHA papel(admin|viewer)
// Exemplo: node gerar-usuario.js Joao senha123 viewer
//
// Copie a linha impressa e cole dentro de data/users.json (respeitando o formato JSON).

const crypto = require('crypto');

const [,, username, password, role] = process.argv;

if (!username || !password || !role) {
  console.log('Uso: node gerar-usuario.js NOME_USUARIO SENHA papel(admin|viewer)');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');
const stored = salt + ':' + hash;

console.log('\nAdicione esta entrada dentro do objeto em data/users.json:\n');
console.log(`"${username}": { "password": "${stored}", "role": "${role}" }`);
console.log('\nLembre-se de reiniciar o serviço no Render após editar o arquivo.');
