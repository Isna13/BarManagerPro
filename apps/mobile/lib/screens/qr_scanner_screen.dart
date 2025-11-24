import 'package:flutter/material.dart';
import 'package:qr_code_scanner/qr_code_scanner.dart';

class QRScannerScreen extends StatefulWidget {
  const QRScannerScreen({super.key});

  @override
  State<QRScannerScreen> createState() => _QRScannerScreenState();
}

class _QRScannerScreenState extends State<QRScannerScreen> {
  final GlobalKey qrKey = GlobalKey(debugLabel: 'QR');
  QRViewController? controller;
  String? scannedCode;

  @override
  void dispose() {
    controller?.dispose();
    super.dispose();
  }

  void _onQRViewCreated(QRViewController controller) {
    this.controller = controller;
    controller.scannedDataStream.listen((scanData) {
      if (scannedCode == null) {
        setState(() {
          scannedCode = scanData.code;
        });
        _handleScannedCode(scanData.code!);
      }
    });
  }

  Future<void> _handleScannedCode(String code) async {
    await controller?.pauseCamera();

    if (!mounted) return;

    // Verificar se é código de menu (menu-{branchId})
    if (code.startsWith('menu-')) {
      Navigator.pushNamed(context, '/qr-menu', arguments: {'menuId': code});
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Código QR: $code')),
      );
    }

    // Reset após 2 segundos
    await Future.delayed(const Duration(seconds: 2));
    if (mounted) {
      setState(() => scannedCode = null);
      await controller?.resumeCamera();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scanner QR'),
        backgroundColor: Colors.purple.shade700,
        foregroundColor: Colors.white,
      ),
      body: Column(
        children: [
          Expanded(
            flex: 4,
            child: QRView(
              key: qrKey,
              onQRViewCreated: _onQRViewCreated,
              overlay: QrScannerOverlayShape(
                borderColor: Colors.purple,
                borderRadius: 10,
                borderLength: 30,
                borderWidth: 10,
                cutOutSize: 300,
              ),
            ),
          ),
          Expanded(
            flex: 1,
            child: Container(
              padding: const EdgeInsets.all(16),
              color: Colors.white,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (scannedCode != null)
                    Text(
                      'Código: $scannedCode',
                      style: const TextStyle(fontSize: 16),
                    )
                  else
                    const Text(
                      'Aponte a câmera para o código QR',
                      style: TextStyle(fontSize: 16),
                    ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.flash_off),
                        onPressed: () => controller?.toggleFlash(),
                      ),
                      const SizedBox(width: 24),
                      IconButton(
                        icon: const Icon(Icons.flip_camera_android),
                        onPressed: () => controller?.flipCamera(),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
