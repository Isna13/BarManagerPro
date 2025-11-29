import 'dart:io';

class ApiConfig {
  // Configuração da URL base da API
  // Para dispositivos físicos, substitua pelo IP da sua máquina
  // Para emulador Android: use 10.0.2.2
  // Para emulador iOS: use localhost
  // Para dispositivo físico: use o IP local da máquina (ex: 192.168.1.100)

  static String get baseUrl {
    if (Platform.isAndroid) {
      // Dispositivo físico conectado - usando IP da máquina host
      return 'http://192.168.1.228:3000/api/v1';
    } else if (Platform.isIOS) {
      // iOS simulator pode usar localhost
      return 'http://localhost:3000/api/v1';
    }
    return 'http://localhost:3000/api/v1';
  }

  // Timeout configurations
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 15);

  // Para usar em dispositivo físico, defina seu IP local aqui
  // e descomente a função abaixo

  /*
  static String get baseUrl {
    // Substitua pelo IP da sua máquina na rede local
    const localIP = '192.168.1.100'; // MODIFIQUE AQUI
    return 'http://$localIP:3000/api/v1';
  }
  */
}
