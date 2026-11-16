import 'package:flutter/material.dart';
import 'package:ntemo_one_mobile/core/api/api_client.dart';
import 'package:ntemo_one_mobile/core/auth/auth_controller.dart';
import 'package:ntemo_one_mobile/core/constants/app_constants.dart';
import 'package:provider/provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscure = true;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    if (!(_formKey.currentState?.validate() ?? false)) return;

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await context.read<AuthController>().login(_emailController.text, _passwordController.text);
      // La navigation est gérée par AuthGate (écoute du statut).
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.errors?.values.expand((m) => m).firstOrNull ?? e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = 'Connexion impossible. Réessayez dans un instant.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  InputDecoration _fieldDecoration(String hint, {Widget? suffix}) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Colors.white38, fontSize: 14),
        filled: true,
        fillColor: AppColors.navyDeep,
        contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(32), borderSide: BorderSide.none),
        errorStyle: const TextStyle(color: Color(0xFFFCA5A5)),
        suffixIcon: suffix,
      );

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(left: 12, bottom: 8),
        child: Text(
          text,
          style: const TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w600),
        ),
      );

  @override
  Widget build(BuildContext context) {
    final sessionMessage = context.select<AuthController, String?>((a) => a.sessionMessage);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Image.asset(
                    'assets/logo.png',
                    height: 96,
                    errorBuilder: (_, __, ___) => const Icon(Icons.business_center, size: 72, color: AppColors.primary),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'NTEMO ONE',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1,
                      color: AppColors.navy,
                    ),
                  ),
                  const SizedBox(height: 28),
                  Container(
                    padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
                    decoration: BoxDecoration(
                      color: AppColors.navy,
                      borderRadius: BorderRadius.circular(28),
                    ),
                    child: Form(
                      key: _formKey,
                      child: AutofillGroup(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const Text(
                              'Connexion',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 24),
                            if (sessionMessage != null && _error == null) ...[
                              _Banner(text: sessionMessage, color: AppColors.accent),
                              const SizedBox(height: 16),
                            ],
                            _label('Adresse e-mail'),
                            TextFormField(
                              key: const Key('login-email'),
                              controller: _emailController,
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.next,
                              autofillHints: const [AutofillHints.email, AutofillHints.username],
                              autocorrect: false,
                              style: const TextStyle(color: Colors.white),
                              cursorColor: AppColors.accent,
                              decoration: _fieldDecoration('Entrez votre adresse e-mail'),
                              validator: (v) {
                                final value = v?.trim() ?? '';
                                if (value.isEmpty) return 'L’adresse e-mail est requise.';
                                if (!value.contains('@') || !value.contains('.')) return 'Adresse e-mail invalide.';
                                return null;
                              },
                            ),
                            const SizedBox(height: 18),
                            _label('Mot de passe'),
                            TextFormField(
                              key: const Key('login-password'),
                              controller: _passwordController,
                              obscureText: _obscure,
                              textInputAction: TextInputAction.done,
                              autofillHints: const [AutofillHints.password],
                              onFieldSubmitted: (_) => _submitting ? null : _submit(),
                              style: const TextStyle(color: Colors.white),
                              cursorColor: AppColors.accent,
                              decoration: _fieldDecoration(
                                'Entrez votre mot de passe',
                                suffix: IconButton(
                                  tooltip: _obscure ? 'Afficher le mot de passe' : 'Masquer le mot de passe',
                                  icon: Icon(
                                    _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                                    color: Colors.white54,
                                  ),
                                  onPressed: () => setState(() => _obscure = !_obscure),
                                ),
                              ),
                              validator: (v) => (v == null || v.isEmpty) ? 'Le mot de passe est requis.' : null,
                            ),
                            if (_error != null) ...[
                              const SizedBox(height: 16),
                              _Banner(text: _error!, color: const Color(0xFFF87171)),
                            ],
                            const SizedBox(height: 24),
                            FilledButton(
                              key: const Key('login-submit'),
                              onPressed: _submitting ? null : _submit,
                              style: FilledButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                disabledBackgroundColor: AppColors.primary.withValues(alpha: 0.6),
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(32)),
                              ),
                              child: _submitting
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                    )
                                  : const Text('Se connecter', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  final String text;
  final Color color;

  const _Banner({required this.text, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(text, style: TextStyle(color: color, fontSize: 13)),
    );
  }
}
