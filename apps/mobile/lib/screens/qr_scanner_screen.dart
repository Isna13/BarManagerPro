import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class QRScannerScreen extends StatefulWidget {
  const QRScannerScreen({super.key});

  @override
  State<QRScannerScreen> createState() => _QRScannerScreenState();
}

class _QRScannerScreenState extends State<QRScannerScreen> {
  final MobileScannerController controller = MobileScannerController();
  String? scannedCode;
  bool isProcessing = false;

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  Future<void> _handleScannedCode(String code) async {
    if (isProcessing) return;

    setState(() {
      isProcessing = true;
      scannedCode = code;
    });

    // Verificar se é código de menu (menu-{branchId})
    if (code.startsWith('menu-')) {
      if (mounted) {
        Navigator.pushNamed(context, '/qr-menu', arguments: {'menuId': code});
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Código QR: $code')),
        );
      }
    }

    // Reset após 2 segundos
    await Future.delayed(const Duration(seconds: 2));
    if (mounted) {
      setState(() {
        scannedCode = null;
        isProcessing = false;
      });
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
            child: MobileScanner(
              controller: controller,
              onDetect: (capture) {
                final List<Barcode> barcodes = capture.barcodes;
                if (barcodes.isNotEmpty && barcodes.first.rawValue != null) {
                  final String code = barcodes.first.rawValue!;
                  _handleScannedCode(code);
                }
              },
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
                        icon: Icon(
                          controller.torchEnabled
                              ? Icons.flash_on
                              : Icons.flash_off,
                        ),
                        onPressed: () => controller.toggleTorch(),
                      ),
                      const SizedBox(width: 24),
                      IconButton(
                        icon: const Icon(Icons.flip_camera_android),
                        onPressed: () => controller.switchCamera(),
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
