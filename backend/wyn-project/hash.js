// Este script Node.js gera um hash bcrypt para uma senha.
// Você precisa ter o bcrypt instalado: npm install bcrypt
const bcrypt = require('bcrypt');

// --- Configuração ---
const senhaEmTextoPuro = 'admin'; // <-- COLOQUE A SENHA QUE VOCÊ QUER USAR AQUI
const saltRounds = 10; // Nível de complexidade do hash (10 é um bom valor padrão)
// --- Fim Configuração ---

async function generateHash() {
  try {
    const hash = await bcrypt.hash(senhaEmTextoPuro, saltRounds);
    console.log('Senha original:', senhaEmTextoPuro);
    console.log('Hash Bcrypt gerado:', hash);
    console.log('\nUse este HASH ao inserir o usuário no banco de dados.');
  } catch (error) {
    console.error('Erro ao gerar o hash:', error);
  }
}

generateHash();
