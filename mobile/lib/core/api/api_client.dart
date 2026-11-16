import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  /// Erreurs de validation Laravel (champ → messages), si présentes.
  final Map<String, List<String>>? errors;

  ApiException(this.message, {this.statusCode, this.errors});

  bool get isUnauthorized => statusCode == 401;

  @override
  String toString() => message;
}

class ApiClient {
  final String baseUrl;
  final http.Client _http;
  final Duration timeout;
  String? _authToken;

  /// Appelé lorsqu'une requête authentifiée reçoit un 401 (jeton expiré ou révoqué).
  void Function()? onUnauthorized;

  ApiClient({
    required this.baseUrl,
    http.Client? httpClient,
    this.timeout = const Duration(seconds: 20),
  }) : _http = httpClient ?? http.Client();

  void setToken(String? token) {
    _authToken = token;
  }

  bool get hasToken => _authToken != null;

  Map<String, String> _buildHeaders() {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (_authToken != null) {
      headers['Authorization'] = 'Bearer $_authToken';
    }

    return headers;
  }

  Future<dynamic> get(String endpoint) =>
      _send(() => _http.get(Uri.parse('$baseUrl$endpoint'), headers: _buildHeaders()));

  Future<dynamic> post(String endpoint, [Map<String, dynamic>? body]) => _send(() => _http.post(
        Uri.parse('$baseUrl$endpoint'),
        headers: _buildHeaders(),
        body: body == null ? null : jsonEncode(body),
      ));

  Future<dynamic> put(String endpoint, Map<String, dynamic> body) => _send(() => _http.put(
        Uri.parse('$baseUrl$endpoint'),
        headers: _buildHeaders(),
        body: jsonEncode(body),
      ));

  Future<dynamic> _send(Future<http.Response> Function() request) async {
    final hadToken = _authToken != null;
    final http.Response response;
    try {
      response = await request().timeout(timeout);
    } on TimeoutException {
      throw ApiException('Le serveur ne répond pas. Vérifiez votre connexion et réessayez.');
    } on SocketException {
      throw ApiException('Serveur injoignable. Vérifiez votre connexion réseau.');
    } on http.ClientException {
      throw ApiException('Erreur de connexion au serveur.');
    }

    try {
      return _handleResponse(response);
    } on ApiException catch (e) {
      if (e.isUnauthorized && hadToken) {
        onUnauthorized?.call();
      }
      rethrow;
    }
  }

  dynamic _handleResponse(http.Response response) {
    dynamic jsonBody;
    try {
      jsonBody = jsonDecode(utf8.decode(response.bodyBytes));
    } catch (_) {
      jsonBody = null;
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonBody;
    }

    final message = jsonBody is Map && jsonBody['message'] is String
        ? jsonBody['message'] as String
        : 'Une erreur est survenue (${response.statusCode})';

    Map<String, List<String>>? errors;
    if (jsonBody is Map && jsonBody['errors'] is Map) {
      errors = (jsonBody['errors'] as Map).map(
        (key, value) => MapEntry(
          key.toString(),
          value is List ? value.map((e) => e.toString()).toList() : [value.toString()],
        ),
      );
    }

    throw ApiException(message, statusCode: response.statusCode, errors: errors);
  }
}
