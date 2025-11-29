import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('🔐 Criando usuário admin...');

    // Verificar se já existe
    const existing = await prisma.user.findUnique({
      where: { email: 'admin@barmanager.com' },
    });

    if (existing) {
      console.log('✅ Usuário admin já existe!');
      console.log('   Email: admin@barmanager.com');
      console.log('   Senha: admin123');
      return;
    }

    // Criar senha hasheada
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Criar usuário admin
    const admin = await prisma.user.create({
      data: {
        email: 'admin@barmanager.com',
        password: hashedPassword,
        name: 'Administrador',
        fullName: 'Administrador do Sistema',
        role: 'admin',
        isActive: true,
        language: 'pt',
      },
    });

    console.log('✅ Usuário admin criado com sucesso!');
    console.log('   ID:', admin.id);
    console.log('   Email: admin@barmanager.com');
    console.log('   Senha: admin123');
    console.log('');
    console.log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
  } catch (error) {
    console.error('❌ Erro ao criar admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
