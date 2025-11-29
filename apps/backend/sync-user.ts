import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function syncUser() {
  try {
    // Dados do usuário Isna Tchuda
    const email = 'itchuda@gmail.com';
    const password = 'Sábado@11';
    const fullName = 'Isna Tchuda';
    
    console.log(`🔍 Verificando se usuário ${email} existe...`);
    
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      console.log('⚠️ Usuário já existe no backend!');
      console.log('   ID:', existing.id);
      console.log('   Email:', existing.email);
      console.log('   Nome:', existing.fullName);
      
      // Atualizar senha se necessário
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.user.update({
        where: { email },
        data: { 
          password: hashedPassword,
          isActive: true,
        },
      });
      console.log('✅ Senha atualizada!');
      return;
    }

    // Criar usuário
    console.log('📝 Criando usuário no backend...');
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: fullName,
        fullName,
        role: 'admin', // ou 'manager', 'cashier', etc
        isActive: true,
        language: 'pt',
      },
    });

    console.log('✅ Usuário criado com sucesso!');
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Nome:', user.fullName);
    console.log('   Role:', user.role);
    console.log('');
    console.log('🎉 Agora você pode fazer login com:');
    console.log(`   Email: ${email}`);
    console.log(`   Senha: ${password}`);
  } catch (error) {
    console.error('❌ Erro ao sincronizar usuário:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncUser();
