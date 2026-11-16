import 'package:flutter/material.dart';
import 'package:ntemo_one_mobile/core/api/api_client.dart';
import 'package:ntemo_one_mobile/core/auth/auth_controller.dart';
import 'package:ntemo_one_mobile/core/constants/app_constants.dart';
import 'package:provider/provider.dart';

/// Écran de connexion — cercle dégradé aux couleurs du logo, champs en pilule,
/// bouton aligné à droite. Pas d'inscription ni de connexion sociale :
/// les comptes sont créés par le service RH.
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

  void _showForgotPassword() {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.lock_reset, color: AppColors.logoBlue),
        title: const Text('Mot de passe oublié'),
        content: const Text(
          'Pour réinitialiser votre mot de passe, contactez le service RH ou l’administrateur de votre organisation.',
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(ctx),
            style: FilledButton.styleFrom(backgroundColor: AppColors.logoBlue),
            child: const Text('Compris'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final sessionMessage = context.select<AuthController, String?>((a) => a.sessionMessage);
    final width = MediaQuery.sizeOf(context).width;
    final circle = width * 1.15;

    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          // Grand cercle dégradé (couleurs du logo) en haut à gauche
          Positioned(
            left: -circle * 0.32,
            top: -circle * 0.42,
            child: IgnorePointer(
              child: Container(
                width: circle,
                height: circle,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [AppColors.logoMist, Color(0xFFEAF6FC), Color(0x00FFFFFF)],
                    stops: [0.0, 0.6, 1.0],
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) => SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 28),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  child: IntrinsicHeight(
                    child: Form(
                      key: _formKey,
                      child: AutofillGroup(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const SizedBox(height: 28),
                            Align(
                              alignment: Alignment.centerLeft,
                              child: Image.asset(
                                'assets/logo_hd.png',
                                height: 64,
                                filterQuality: FilterQuality.high,
                                semanticLabel: 'Logo NTEMO',
                                errorBuilder: (_, __, ___) =>
                                    const Icon(Icons.business_center, size: 56, color: AppColors.logoBlue),
                              ),
                            ),
                            const Spacer(flex: 3),
                            const SizedBox(height: 32),
                            const Text(
                              'Connexion',
                              style: TextStyle(
                                fontSize: 34,
                                fontWeight: FontWeight.w800,
                                color: AppColors.logoNavy,
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text.rich(
                              TextSpan(
                                style: TextStyle(fontSize: 14, color: Color(0xFF5B6B7F)),
                                children: [
                                  TextSpan(text: 'Bienvenue sur '),
                                  TextSpan(
                                    text: 'NTEMO ONE',
                                    style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.logoCyan),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 32),
                            if (sessionMessage != null && _error == null) ...[
                              _Banner(text: sessionMessage, color: AppColors.logoBlue),
                              const SizedBox(height: 16),
                            ],
                            _PillField(
                              fieldKey: const Key('login-email'),
                              controller: _emailController,
                              hint: 'Adresse e-mail',
                              icon: Icons.mail_outline,
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.next,
                              autofillHints: const [AutofillHints.email, AutofillHints.username],
                              validator: (v) {
                                final value = v?.trim() ?? '';
                                if (value.isEmpty) return 'L’adresse e-mail est requise.';
                                if (!value.contains('@') || !value.contains('.')) return 'Adresse e-mail invalide.';
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),
                            _PillField(
                              fieldKey: const Key('login-password'),
                              controller: _passwordController,
                              hint: 'Mot de passe',
                              icon: Icons.lock_outline,
                              obscureText: _obscure,
                              textInputAction: TextInputAction.done,
                              autofillHints: const [AutofillHints.password],
                              onSubmitted: (_) => _submitting ? null : _submit(),
                              validator: (v) => (v == null || v.isEmpty) ? 'Le mot de passe est requis.' : null,
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    tooltip: _obscure ? 'Afficher le mot de passe' : 'Masquer le mot de passe',
                                    visualDensity: VisualDensity.compact,
                                    icon: Icon(
                                      _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                                      size: 20,
                                      color: const Color(0xFF8A97A8),
                                    ),
                                    onPressed: () => setState(() => _obscure = !_obscure),
                                  ),
                                  TextButton(
                                    key: const Key('login-forgot'),
                                    onPressed: _showForgotPassword,
                                    style: TextButton.styleFrom(
                                      foregroundColor: AppColors.logoCyan,
                                      padding: const EdgeInsets.only(left: 4, right: 16),
                                      minimumSize: const Size(0, 40),
                                    ),
                                    child: const Text(
                                      'OUBLIÉ ?',
                                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 0.5),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (_error != null) ...[
                              const SizedBox(height: 16),
                              _Banner(text: _error!, color: const Color(0xFFDC2626)),
                            ],
                            const SizedBox(height: 36),
                            Align(
                              alignment: Alignment.centerRight,
                              child: _GradientButton(
                                key: const Key('login-submit'),
                                loading: _submitting,
                                onPressed: _submitting ? null : _submit,
                              ),
                            ),
                            const Spacer(flex: 4),
                            const Padding(
                              padding: EdgeInsets.only(top: 32, bottom: 20),
                              child: Text(
                                'Accès réservé aux collaborateurs.\nVotre compte est créé par le service RH.',
                                textAlign: TextAlign.center,
                                style: TextStyle(fontSize: 12, color: Color(0xFF8A97A8), height: 1.5),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Champ de saisie en pilule, bordure fine et légère ombre.
class _PillField extends StatelessWidget {
  final Key fieldKey;
  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onSubmitted;
  final Widget? trailing;

  const _PillField({
    required this.fieldKey,
    required this.controller,
    required this.hint,
    required this.icon,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.validator,
    this.onSubmitted,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    OutlineInputBorder border(Color color, [double width = 1.2]) => OutlineInputBorder(
          borderRadius: BorderRadius.circular(32),
          borderSide: BorderSide(color: color, width: width),
        );

    return TextFormField(
      key: fieldKey,
      controller: controller,
      obscureText: obscureText,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      autofillHints: autofillHints,
      autocorrect: false,
      enableSuggestions: !obscureText,
      onFieldSubmitted: onSubmitted,
      validator: validator,
      cursorColor: AppColors.logoBlue,
      style: const TextStyle(fontSize: 15, color: AppColors.logoNavy),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Color(0xFF9AA6B5), fontSize: 14),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
        prefixIcon: Padding(
          padding: const EdgeInsets.only(left: 18, right: 10),
          child: Icon(icon, size: 20, color: const Color(0xFF8A97A8)),
        ),
        prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        suffixIcon: trailing,
        enabledBorder: border(const Color(0xFFD5DEE8)),
        focusedBorder: border(AppColors.logoCyan, 1.6),
        errorBorder: border(const Color(0xFFF87171)),
        focusedErrorBorder: border(const Color(0xFFDC2626), 1.6),
        errorStyle: const TextStyle(color: Color(0xFFDC2626)),
      ),
    );
  }
}

/// Bouton principal : pilule au dégradé du logo, icône de connexion à droite.
class _GradientButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final bool loading;

  const _GradientButton({super.key, required this.onPressed, required this.loading});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: 'Se connecter',
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: AppColors.logoGradient,
          borderRadius: BorderRadius.circular(32),
          boxShadow: [
            BoxShadow(
              color: AppColors.logoBlue.withValues(alpha: 0.35),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Material(
          type: MaterialType.transparency,
          child: InkWell(
            onTap: onPressed,
            borderRadius: BorderRadius.circular(32),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 15),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (loading)
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  else
                    const Text(
                      'Se connecter',
                      style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700),
                    ),
                  const SizedBox(width: 12),
                  const Icon(Icons.login_rounded, color: Colors.white, size: 22),
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
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(text, style: TextStyle(color: color, fontSize: 13)),
    );
  }
}
