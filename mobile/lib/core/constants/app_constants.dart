import 'package:flutter/painting.dart';

class AppConstants {
  static const String appName = 'NTEMO ONE';

  /// URL de l'API, surchargeable au build :
  /// `flutter run --dart-define=API_BASE_URL=http://192.168.1.10:8000/api/v1`
  /// Par défaut : l'hôte de la machine vu depuis l'émulateur Android.
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:8000/api/v1',
  );

  // Storage keys
  static const String tokenKey = 'ntemo_auth_token';
  static const String userKey = 'ntemo_user_profile';

  // Attendance constants
  static const int qrTtlSeconds = 15;
}

/// Palette NTEMO (alignée sur l'interface web).
class AppColors {
  static const Color primary = Color(0xFF0284C7);
  static const Color accent = Color(0xFF38BDF8);
  static const Color navy = Color(0xFF0A2544);
  static const Color navyDeep = Color(0xFF061424);

  // Couleurs extraites du logo (dégradé cyan → bleu nuit)
  static const Color logoCyan = Color(0xFF1C9BD6);
  static const Color logoBlue = Color(0xFF0D5C9E);
  static const Color logoNavy = Color(0xFF0B2563);
  static const Color logoMist = Color(0xFFD6EEF9);

  static const LinearGradient logoGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [logoCyan, logoBlue, logoNavy],
  );
}
