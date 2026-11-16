import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:ntemo_one_mobile/core/api/api_client.dart';
import 'package:ntemo_one_mobile/core/auth/auth_controller.dart';
import 'package:ntemo_one_mobile/core/auth/token_storage.dart';
import 'package:ntemo_one_mobile/core/constants/app_constants.dart';
import 'package:ntemo_one_mobile/features/attendance/screens/attendance_scan_screen.dart';
import 'package:ntemo_one_mobile/features/auth/screens/login_screen.dart';
import 'package:ntemo_one_mobile/features/badge/screens/virtual_badge_screen.dart';
import 'package:ntemo_one_mobile/features/leaves/screens/leaves_screen.dart';
import 'package:ntemo_one_mobile/features/notifications/screens/notifications_screen.dart';
import 'package:ntemo_one_mobile/features/notifications/services/notifications_service.dart';
import 'package:ntemo_one_mobile/features/tasks/screens/tasks_screen.dart';
import 'package:ntemo_one_mobile/features/profile/screens/profile_screen.dart';
import 'package:provider/provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('fr_FR');
  final apiClient = ApiClient(baseUrl: AppConstants.apiBaseUrl);
  final auth = AuthController(apiClient: apiClient, storage: SecureSessionStorage())..restore();
  runApp(NtemoOneApp(apiClient: apiClient, auth: auth));
}

class NtemoOneApp extends StatelessWidget {
  final ApiClient apiClient;
  final AuthController auth;

  const NtemoOneApp({super.key, required this.apiClient, required this.auth});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: apiClient),
        ChangeNotifierProvider<AuthController>.value(value: auth),
      ],
      child: MaterialApp(
        title: AppConstants.appName,
        debugShowCheckedModeBanner: false,
        locale: const Locale('fr', 'FR'),
        supportedLocales: const [Locale('fr', 'FR'), Locale('en')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: AppColors.primary,
            primary: AppColors.primary,
          ),
          useMaterial3: true,
        ),
        home: const AuthGate(),
      ),
    );
  }
}

/// Aiguille entre l'écran de connexion et l'application selon l'état de session.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final status = context.select<AuthController, AuthStatus>((a) => a.status);

    switch (status) {
      case AuthStatus.unknown:
        return const Scaffold(
          backgroundColor: Colors.white,
          body: Center(child: CircularProgressIndicator()),
        );
      case AuthStatus.unauthenticated:
        return const LoginScreen();
      case AuthStatus.authenticated:
        // Clé liée à l'utilisateur : un changement de compte recrée les écrans (pas de données résiduelles).
        final userId = context.select<AuthController, String?>((a) => a.user?.id);
        return MainNavigationScreen(key: ValueKey(userId));
    }
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> with WidgetsBindingObserver {
  static const _pollInterval = Duration(seconds: 60);

  int _currentIndex = 0;
  int _unread = 0;
  late final NotificationsService _notifications;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _notifications = NotificationsService(apiClient: context.read<ApiClient>());
    WidgetsBinding.instance.addObserver(this);
    _refreshUnread();
    _timer = Timer.periodic(_pollInterval, (_) => _refreshUnread());
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Retour au premier plan : compteur à jour immédiatement
    if (state == AppLifecycleState.resumed) _refreshUnread();
  }

  Future<void> _refreshUnread() async {
    try {
      final count = await _notifications.unreadCount();
      if (mounted && count != _unread) setState(() => _unread = count);
    } catch (_) {
      // Réseau indisponible : le compteur sera mis à jour au prochain cycle
    }
  }

  Future<void> _openNotifications() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => NotificationsScreen(service: _notifications)),
    );
    _refreshUnread();
  }

  @override
  Widget build(BuildContext context) {
    final apiClient = context.read<ApiClient>();

    return Scaffold(
      appBar: AppBar(
        leading: Padding(
          padding: const EdgeInsets.all(8.0),
          child: Image.asset(
            'assets/logo_hd.png',
            errorBuilder: (_, __, ___) => const Icon(Icons.business_center),
          ),
        ),
        title: const Text(
          'NTEMO ONE',
          style: TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5),
        ),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0.5,
        actions: [
          IconButton(
            key: const Key('notifications-bell'),
            tooltip: _unread > 0 ? '$_unread notification(s) non lue(s)' : 'Notifications',
            onPressed: _openNotifications,
            icon: Badge(
              isLabelVisible: _unread > 0,
              label: Text(_unread > 99 ? '99+' : '$_unread'),
              child: const Icon(Icons.notifications_none_outlined),
            ),
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: [
          AttendanceScanScreen(apiClient: apiClient),
          VirtualBadgeScreen(apiClient: apiClient),
          TasksScreen(apiClient: apiClient),
          LeavesScreen(apiClient: apiClient),
          ProfileScreen(apiClient: apiClient),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (idx) => setState(() => _currentIndex = idx),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.qr_code_scanner_outlined),
            selectedIcon: Icon(Icons.qr_code_scanner),
            label: 'Pointage',
          ),
          NavigationDestination(
            icon: Icon(Icons.badge_outlined),
            selectedIcon: Icon(Icons.badge),
            label: 'Badge',
          ),
          NavigationDestination(
            icon: Icon(Icons.task_alt_outlined),
            selectedIcon: Icon(Icons.task_alt),
            label: 'Tâches',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            selectedIcon: Icon(Icons.calendar_month),
            label: 'Congés',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profil',
          ),
        ],
      ),
    );
  }
}
