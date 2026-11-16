import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ntemo_one_mobile/core/api/api_client.dart';
import 'package:ntemo_one_mobile/core/auth/auth_controller.dart';
import 'package:ntemo_one_mobile/core/auth/token_storage.dart';
import 'package:ntemo_one_mobile/features/auth/screens/login_screen.dart';
import 'package:provider/provider.dart';

const _loginOk = {
  'success': true,
  'data': {
    'token': 'tok-123',
    'user': {
      'id': 'u1',
      'name': 'Alice Martin',
      'email': 'alice@ntemo.com',
      'role_name': 'Collaborateur',
      'roles': ['employee'],
      'permissions': ['attendance.point_self'],
      'employee': {'matricule': 'NTM-2026-0001', 'department': 'RH', 'position': 'Chargée RH'},
      'organization': {'id': 'o1', 'name': 'NTEMO Consulting', 'slug': 'ntemo'},
    },
  },
};

http.Response _json(Object body, int status) => http.Response.bytes(
      utf8.encode(jsonEncode(body)),
      status,
      headers: {'content-type': 'application/json; charset=utf-8'},
    );

/// Serveur factice : login OK pour le bon mot de passe, 422 sinon ; /auth/me renvoie [meStatus].
MockClient _server({int meStatus = 200, List<http.Request>? log}) => MockClient((req) async {
      log?.add(req);
      if (req.url.path.endsWith('/auth/login')) {
        final body = jsonDecode(req.body) as Map<String, dynamic>;
        if (body['password'] == 'secret') return _json(_loginOk, 200);
        return _json({
          'message': 'Identifiants invalides.',
          'errors': {
            'email': ['Identifiants de connexion invalides.'],
          },
        }, 422);
      }
      if (req.url.path.endsWith('/auth/me')) return _json({'message': 'Unauthenticated.'}, meStatus);
      if (req.url.path.endsWith('/auth/logout')) return _json({'success': true}, 200);
      return _json({'message': 'not found'}, 404);
    });

void main() {
  group('AuthController', () {
    test('login persists the session and sets the bearer token', () async {
      final log = <http.Request>[];
      final api = ApiClient(baseUrl: 'http://api.test/v1', httpClient: _server(log: log));
      final storage = InMemorySessionStorage();
      final auth = AuthController(apiClient: api, storage: storage);

      await auth.login('  alice@ntemo.com ', 'secret');

      expect(auth.status, AuthStatus.authenticated);
      expect(auth.user!.matricule, 'NTM-2026-0001');
      expect(auth.user!.can('attendance.point_self'), isTrue);
      expect(storage.token, 'tok-123');
      expect(jsonDecode(log.single.body)['email'], 'alice@ntemo.com');

      await api.get('/auth/me').catchError((_) => null);
      expect(log.last.headers['Authorization'], 'Bearer tok-123');
    });

    test('wrong password throws ApiException with validation message', () async {
      final api = ApiClient(baseUrl: 'http://api.test/v1', httpClient: _server());
      final auth = AuthController(apiClient: api, storage: InMemorySessionStorage());

      expect(
        () => auth.login('alice@ntemo.com', 'bad'),
        throwsA(isA<ApiException>().having((e) => e.errors?['email']?.first, 'email error',
            'Identifiants de connexion invalides.')),
      );
    });

    test('restore reloads a persisted session', () async {
      final storage = InMemorySessionStorage()
        ..token = 'tok-123'
        ..user = jsonEncode((_loginOk['data'] as Map)['user']);
      final auth = AuthController(
        apiClient: ApiClient(baseUrl: 'http://api.test/v1', httpClient: _server()),
        storage: storage,
      );

      await auth.restore();

      expect(auth.status, AuthStatus.authenticated);
      expect(auth.user!.name, 'Alice Martin');
    });

    test('a 401 on an authenticated call logs the user out', () async {
      final api = ApiClient(baseUrl: 'http://api.test/v1', httpClient: _server(meStatus: 401));
      final storage = InMemorySessionStorage();
      final auth = AuthController(apiClient: api, storage: storage);
      await auth.login('alice@ntemo.com', 'secret');

      await expectLater(api.get('/auth/me'), throwsA(isA<ApiException>()));
      await Future<void>.delayed(Duration.zero);

      expect(auth.status, AuthStatus.unauthenticated);
      expect(auth.sessionMessage, contains('session a expiré'));
      expect(storage.token, isNull);
      expect(api.hasToken, isFalse);
    });

    test('logout clears the session', () async {
      final api = ApiClient(baseUrl: 'http://api.test/v1', httpClient: _server());
      final storage = InMemorySessionStorage();
      final auth = AuthController(apiClient: api, storage: storage);
      await auth.login('alice@ntemo.com', 'secret');

      await auth.logout();

      expect(auth.status, AuthStatus.unauthenticated);
      expect(storage.token, isNull);
    });
  });

  group('LoginScreen', () {
    Future<AuthController> pump(WidgetTester tester) async {
      final auth = AuthController(
        apiClient: ApiClient(baseUrl: 'http://api.test/v1', httpClient: _server()),
        storage: InMemorySessionStorage(),
      );
      await tester.pumpWidget(
        ChangeNotifierProvider.value(value: auth, child: const MaterialApp(home: LoginScreen())),
      );
      return auth;
    }

    testWidgets('validates empty fields', (tester) async {
      await pump(tester);
      await tester.tap(find.byKey(const Key('login-submit')));
      await tester.pump();

      expect(find.text('L’adresse e-mail est requise.'), findsOneWidget);
      expect(find.text('Le mot de passe est requis.'), findsOneWidget);
    });

    testWidgets('shows the server error on bad credentials', (tester) async {
      final auth = await pump(tester);
      await tester.enterText(find.byKey(const Key('login-email')), 'alice@ntemo.com');
      await tester.enterText(find.byKey(const Key('login-password')), 'bad');
      await tester.tap(find.byKey(const Key('login-submit')));
      await tester.pumpAndSettle();

      expect(find.text('Identifiants de connexion invalides.'), findsOneWidget);
      expect(auth.status, isNot(AuthStatus.authenticated));
    });

    testWidgets('signs in with valid credentials', (tester) async {
      final auth = await pump(tester);
      await tester.enterText(find.byKey(const Key('login-email')), 'alice@ntemo.com');
      await tester.enterText(find.byKey(const Key('login-password')), 'secret');
      await tester.tap(find.byKey(const Key('login-submit')));
      await tester.pumpAndSettle();

      expect(auth.status, AuthStatus.authenticated);
    });
  });
}
