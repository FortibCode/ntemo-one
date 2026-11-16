import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:ntemo_one_mobile/core/constants/app_constants.dart';

/// Scanner caméra plein écran. Renvoie (via `Navigator.pop`) le contenu brut du
/// premier QR code détecté, ou `null` si l'utilisateur annule.
///
/// Ouvert comme route dédiée : la caméra n'est active que pendant le scan.
class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: const [BarcodeFormat.qrCode],
  );
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue?.trim();
      if (value != null && value.isNotEmpty) {
        _handled = true;
        Navigator.of(context).pop(value);
        return;
      }
    }
  }

  Widget _errorView(BuildContext context, MobileScannerException error, Widget? _) {
    final denied = error.errorCode == MobileScannerErrorCode.permissionDenied;
    return ColoredBox(
      color: Colors.black,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(denied ? Icons.no_photography_outlined : Icons.error_outline, color: Colors.white70, size: 56),
              const SizedBox(height: 16),
              Text(
                denied
                    ? 'L’accès à la caméra a été refusé. Autorisez-le dans les réglages du téléphone pour scanner le QR code de pointage.'
                    : 'La caméra est indisponible sur cet appareil.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white),
              ),
              const SizedBox(height: 24),
              OutlinedButton(
                onPressed: () => Navigator.of(context).pop(),
                style: OutlinedButton.styleFrom(foregroundColor: Colors.white),
                child: const Text('Retour'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    final windowSize = size.shortestSide * 0.7;
    final scanWindow = Rect.fromCenter(
      center: Offset(size.width / 2, size.height / 2 - 40),
      width: windowSize,
      height: windowSize,
    );

    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: const Text('Scanner le QR de pointage'),
        actions: [
          IconButton(
            tooltip: 'Lampe torche',
            icon: const Icon(Icons.flashlight_on_outlined),
            onPressed: () => _controller.toggleTorch(),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            scanWindow: scanWindow,
            errorBuilder: _errorView,
          ),
          // Cadre de visée
          Positioned.fromRect(
            rect: scanWindow,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  border: Border.all(color: AppColors.accent, width: 3),
                  borderRadius: BorderRadius.circular(24),
                ),
              ),
            ),
          ),
          Positioned(
            left: 24,
            right: 24,
            top: scanWindow.bottom + 24,
            child: const Text(
              'Placez le QR code affiché sur la borne dans le cadre.\nLe code change toutes les ${AppConstants.qrTtlSeconds} secondes.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white, fontSize: 14, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }
}
