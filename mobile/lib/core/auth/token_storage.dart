import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:ntemo_one_mobile/core/constants/app_constants.dart';

/// Persistance de la session (jeton + profil). Abstraite pour être remplaçable en test.
abstract class SessionStorage {
  Future<String?> readToken();
  Future<String?> readUser();
  Future<void> save({required String token, required String userJson});
  Future<void> clear();
}

/// Stockage chiffré (Keychain iOS / Keystore Android).
class SecureSessionStorage implements SessionStorage {
  final FlutterSecureStorage _storage;

  SecureSessionStorage([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  @override
  Future<String?> readToken() => _storage.read(key: AppConstants.tokenKey);

  @override
  Future<String?> readUser() => _storage.read(key: AppConstants.userKey);

  @override
  Future<void> save({required String token, required String userJson}) async {
    await _storage.write(key: AppConstants.tokenKey, value: token);
    await _storage.write(key: AppConstants.userKey, value: userJson);
  }

  @override
  Future<void> clear() async {
    await _storage.delete(key: AppConstants.tokenKey);
    await _storage.delete(key: AppConstants.userKey);
  }
}

/// Stockage en mémoire (tests).
class InMemorySessionStorage implements SessionStorage {
  String? token;
  String? user;

  @override
  Future<String?> readToken() async => token;

  @override
  Future<String?> readUser() async => user;

  @override
  Future<void> save({required String token, required String userJson}) async {
    this.token = token;
    user = userJson;
  }

  @override
  Future<void> clear() async {
    token = null;
    user = null;
  }
}
