import 'package:flutter/material.dart';
import 'package:ntemo_one_mobile/core/api/api_client.dart';
import 'package:ntemo_one_mobile/core/constants/app_constants.dart';
import 'package:ntemo_one_mobile/features/attendance/screens/attendance_scan_screen.dart';
import 'package:ntemo_one_mobile/features/badge/screens/virtual_badge_screen.dart';
import 'package:ntemo_one_mobile/features/leaves/screens/leaves_screen.dart';
import 'package:ntemo_one_mobile/features/profile/screens/profile_screen.dart';

void main() {
  runApp(const NtemoOneApp());
}

class NtemoOneApp extends StatelessWidget {
  const NtemoOneApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'NTEMO ONE',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF4F46E5),
          primary: const Color(0xFF4F46E5),
        ),
        useMaterial3: true,
      ),
      home: const MainNavigationScreen(),
    );
  }
}

class MainNavigationScreen extends StatefulWidget {
  const MainNavigationScreen({super.key});

  @override
  State<MainNavigationScreen> createState() => _MainNavigationScreenState();
}

class _MainNavigationScreenState extends State<MainNavigationScreen> {
  int _currentIndex = 0;
  late final ApiClient _apiClient;

  @override
  void initState() {
    super.initState();
    _apiClient = ApiClient(baseUrl: AppConstants.apiBaseUrl);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: Padding(
          padding: const EdgeInsets.all(8.0),
          child: Image.asset(
            'assets/logo.png',
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
            icon: const Icon(Icons.notifications_none_outlined),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Aucune nouvelle notification.')),
              );
            },
          ),
        ],
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: [
          AttendanceScanScreen(apiClient: _apiClient),
          VirtualBadgeScreen(apiClient: _apiClient),
          LeavesScreen(apiClient: _apiClient),
          ProfileScreen(apiClient: _apiClient),
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
