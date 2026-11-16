import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:ntemo_one_mobile/core/api/api_client.dart';
import 'package:ntemo_one_mobile/core/auth/auth_user.dart';
import 'package:ntemo_one_mobile/core/auth/token_storage.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

/// État de session de l'application : restauration, connexion, déconnexion.
class AuthController extends ChangeNotifier {
  final ApiClient apiClient;
  final SessionStorage storage;

  AuthStatus _status = AuthStatus.unknown;
  AuthUser? _user;
  String? _sessionMessage;

  AuthController({required this.apiClient, required this.storage}) {
    // Jeton expiré / révoqué côté serveur → retour à l'écran de connexion
    apiClient.onUnauthorized = () {
      if (_status == AuthStatus.authenticated) {
        _clearSession(message: 'Votre session a expiré. Veuillez vous reconnecter.');
      }
    };
  }

  AuthStatus get status => _status;
  AuthUser? get user => _user;

  /// Message à afficher sur l'écran de connexion (ex. session expirée).
  String? get sessionMessage => _sessionMessage;

  /// Restaure la session persistée au démarrage.
  Future<void> restore() async {
    try {
      final token = await storage.readToken();
      final userJson = await storage.readUser();
      if (token != null && userJson != null) {
        _user = AuthUser.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
        apiClient.setToken(token);
        _status = AuthStatus.authenticated;
      } else {
        _status = AuthStatus.unauthenticated;
      }
    } catch (_) {
      // Données corrompues ou trousseau inaccessible : repartir d'une session vierge
      await storage.clear().catchError((_) {});
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  /// Lève une [ApiException] avec un message lisible en cas d'échec.
  Future<void> login(String email, String password) async {
    final response = await apiClient.post('/auth/login', {
      'email': email.trim(),
      'password': password,
      'device_name': 'NTEMO ONE Mobile',
    });

    final data = response is Map ? response['data'] : null;
    if (data is! Map || data['token'] is! String || data['user'] is! Map) {
      throw ApiException('Réponse inattendue du serveur.');
    }

    final token = data['token'] as String;
    final user = AuthUser.fromJson(Map<String, dynamic>.from(data['user'] as Map));

    await storage.save(token: token, userJson: jsonEncode(user.toJson()));
    apiClient.setToken(token);
    _user = user;
    _sessionMessage = null;
    _status = AuthStatus.authenticated;
    notifyListeners();
  }

  Future<void> logout() async {
    try {
      // Révocation côté serveur ; la déconnexion locale a lieu même si elle échoue.
      if (apiClient.hasToken) await apiClient.post('/auth/logout');
    } catch (_) {}
    await _clearSession();
  }

  Future<void> _clearSession({String? message}) async {
    apiClient.setToken(null);
    _user = null;
    _sessionMessage = message;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
    await storage.clear().catchError((_) {});
  }
}
