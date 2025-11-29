import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testPassword() {
  try {
    const email = 'itchuda@gmail.com';
    const password = 'Sábado@11';
    
    console.log('🔍 Buscando usuário:', email);
    
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log('❌ Usuário não encontrado!');
      return;
    }

    console.log('\n✅ Usuário encontrado:');
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Nome:', user.fullName);
    console.log('   Role:', user.role);
    console.log('   Ativo:', user.isActive);
    console.log('   Hash da senha:', user.password.substring(0, 20) + '...');
    
    console.log('\n🔐 Testando senha:', password);
    const isValid = await bcrypt.compare(password, user.password);
    
    if (isValid) {
      console.log('✅ Senha VÁLIDA!');
    } else {
      console.log('❌ Senha INVÁLIDA!');
      
      // Testar outras variações
      console.log('\n🔍 Testando variações da senha:');
      const variations = [
        'Sábado@11',
        'Sabado@11',
        'sábado@11',
        'sabado@11',
      ];
      
      for (const variant of variations) {
        const test = await bcrypt.compare(variant, user.password);
        console.log(`   ${variant}: ${test ? '✅ VÁLIDA' : '❌ Inválida'}`);
      }
    }
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPassword();
