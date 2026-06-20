import 'dart:convert';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const AedenBakesCustomerApp());
}

const String _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://127.0.0.1:4000',
);
ThemeData _buildAedenTheme() {
  final baseTextTheme = GoogleFonts.interTextTheme();

  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: AedenPalette.cream,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AedenPalette.gold,
      brightness: Brightness.light,
      primary: AedenPalette.gold,
      secondary: AedenPalette.ink,
      surface: AedenPalette.cream,
    ),
    textTheme: baseTextTheme.copyWith(
      displayLarge: GoogleFonts.fraunces(
        textStyle: baseTextTheme.displayLarge,
        fontWeight: FontWeight.w600,
        color: AedenPalette.ink,
      ),
      displayMedium: GoogleFonts.fraunces(
        textStyle: baseTextTheme.displayMedium,
        fontWeight: FontWeight.w600,
        color: AedenPalette.ink,
      ),
      headlineLarge: GoogleFonts.fraunces(
        textStyle: baseTextTheme.headlineLarge,
        fontWeight: FontWeight.w600,
        color: AedenPalette.ink,
      ),
      headlineMedium: GoogleFonts.fraunces(
        textStyle: baseTextTheme.headlineMedium,
        fontWeight: FontWeight.w600,
        color: AedenPalette.ink,
      ),
      headlineSmall: GoogleFonts.fraunces(
        textStyle: baseTextTheme.headlineSmall,
        fontWeight: FontWeight.w600,
        color: AedenPalette.ink,
      ),
      titleLarge: GoogleFonts.fraunces(
        textStyle: baseTextTheme.titleLarge,
        fontWeight: FontWeight.w600,
        color: AedenPalette.ink,
      ),
      titleMedium: baseTextTheme.titleMedium?.copyWith(
        fontWeight: FontWeight.w700,
        color: AedenPalette.ink,
      ),
      bodyLarge: baseTextTheme.bodyLarge?.copyWith(
        color: AedenPalette.grey,
        height: 1.5,
      ),
      bodyMedium: baseTextTheme.bodyMedium?.copyWith(
        color: AedenPalette.grey,
        height: 1.5,
      ),
      labelLarge: baseTextTheme.labelLarge?.copyWith(
        fontWeight: FontWeight.w700,
        letterSpacing: 0.2,
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: AedenPalette.line,
      space: 1,
      thickness: 1,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AedenPalette.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AedenPalette.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AedenPalette.gold, width: 1.4),
      ),
      labelStyle: const TextStyle(color: AedenPalette.grey),
      hintStyle: const TextStyle(color: AedenPalette.muted),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AedenPalette.gold,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: AedenPalette.ink,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        side: const BorderSide(color: AedenPalette.line),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: AedenPalette.gold,
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: Colors.white,
      selectedColor: AedenPalette.ink,
      disabledColor: AedenPalette.cream,
      side: const BorderSide(color: AedenPalette.line),
      labelStyle:
          baseTextTheme.labelLarge?.copyWith(color: AedenPalette.grey) ??
          const TextStyle(),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
  );
}

class AedenBakesCustomerApp extends StatelessWidget {
  const AedenBakesCustomerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Aeden Bakes Customer',
      theme: _buildAedenTheme(),
      home: const AedenJourney(),
    );
  }
}

enum _JourneyPhase { splash, auth, onboard, review, approved, home }

enum _HomeTab { home, cart, orders, account }

class AedenJourney extends StatefulWidget {
  const AedenJourney({super.key});

  @override
  State<AedenJourney> createState() => _AedenJourneyState();
}

class _AedenJourneyState extends State<AedenJourney> {
  final _phoneController = TextEditingController(text: '9847012345');
  final _businessController = TextEditingController(text: 'Hotel Crescent');
  final _contactController = TextEditingController(text: 'Anand Menon');
  final _addressController = TextEditingController(
    text: 'Gate 2, Service Lane, Marine Drive',
  );
  final _cityController = TextEditingController(text: 'Kochi');
  final _pinController = TextEditingController(text: '682011');
  final _instructionsController = TextEditingController(
    text: 'Deliver to kitchen dock, ask for duty manager',
  );
  final _gstController = TextEditingController(text: '32AAACH1234F1Z9');

  final List<String> _businessTypes = const [
    'Hotel',
    'Cafe',
    'Restaurant',
    'Retailer',
    'Caterer',
  ];
  final List<String> _documentNames = const [
    'GST certificate',
    'FSSAI license',
    'Cancelled cheque',
  ];
  final List<String> _categories = const [
    'All',
    'Breads',
    'Viennoiserie',
    'Cakes',
    'Savory',
    'Retail',
  ];
  final List<String> _dateLabels = const ['Today', 'Tomorrow', 'Pick date'];
  final List<_DeliverySlot> _slots = const [
    _DeliverySlot(
      id: 'slot-1',
      label: '6 - 8 AM',
      note: '4 slots left',
      available: true,
    ),
    _DeliverySlot(
      id: 'slot-2',
      label: '8 - 10 AM',
      note: '2 slots left',
      available: true,
    ),
    _DeliverySlot(
      id: 'slot-3',
      label: '10 - 12 PM',
      note: 'Slot full',
      available: false,
    ),
  ];
  final List<_Product> _catalog = const [
    _Product(
      id: 'brioche',
      name: 'Brioche Buns',
      pack: '6 pack',
      category: 'Breads',
      price: 280,
      remaining: 18,
      cutoff: '4:00 PM',
      emoji: '🥐',
      note: 'Soft, glossy, and made for breakfast service.',
      accentA: Color(0xFFF7D9AB),
      accentB: Color(0xFFD38B33),
    ),
    _Product(
      id: 'sourdough',
      name: 'Sourdough Loaf',
      pack: '1 loaf',
      category: 'Breads',
      price: 320,
      remaining: 12,
      cutoff: '5:00 PM',
      emoji: '🍞',
      note: 'Long-fermented loaf with a crisp, warm crust.',
      accentA: Color(0xFFF6E4C8),
      accentB: Color(0xFFC9853A),
    ),
    _Product(
      id: 'croissant',
      name: 'Butter Croissant',
      pack: '4 pack',
      category: 'Viennoiserie',
      price: 420,
      remaining: 6,
      cutoff: '3:30 PM',
      emoji: '🥐',
      note: 'Layered, flaky, and rich enough for plated service.',
      accentA: Color(0xFFF9EBD0),
      accentB: Color(0xFFE1A12F),
    ),
    _Product(
      id: 'multigrain',
      name: 'Multigrain Loaf',
      pack: '1 loaf',
      category: 'Breads',
      price: 360,
      remaining: 22,
      cutoff: '5:30 PM',
      emoji: '🍞',
      note: 'Hearty service loaf with a clean, premium slice.',
      accentA: Color(0xFFF1DFC2),
      accentB: Color(0xFFB45B28),
    ),
    _Product(
      id: 'pav',
      name: 'Pav Buns',
      pack: '12 pack',
      category: 'Retail',
      price: 160,
      remaining: 30,
      cutoff: '6:00 PM',
      emoji: '🥯',
      note: 'Daily retail staple with a soft, even crumb.',
      accentA: Color(0xFFFFE7C2),
      accentB: Color(0xFFD97706),
    ),
    _Product(
      id: 'plum',
      name: 'Plum Cake',
      pack: '1 loaf',
      category: 'Cakes',
      price: 560,
      remaining: 9,
      cutoff: '2:30 PM',
      emoji: '🎂',
      note: 'Deep caramel notes with a festive, premium finish.',
      accentA: Color(0xFFF8E2C9),
      accentB: Color(0xFF9A3412),
    ),
    _Product(
      id: 'cookie',
      name: 'Choco Cookie Box',
      pack: '12 pack',
      category: 'Retail',
      price: 240,
      remaining: 14,
      cutoff: '4:30 PM',
      emoji: '🍪',
      note: 'Bake-shop style cookies with a dark chocolate finish.',
      accentA: Color(0xFFFBE8C7),
      accentB: Color(0xFFB45309),
    ),
    _Product(
      id: 'focaccia',
      name: 'Herb Focaccia',
      pack: '1 tray',
      category: 'Savory',
      price: 410,
      remaining: 8,
      cutoff: '3:45 PM',
      emoji: '🫓',
      note: 'Olive oil sheen, rosemary finish, dinner-ready presence.',
      accentA: Color(0xFFEFDDB8),
      accentB: Color(0xFF9C6B28),
    ),
  ];
  final List<_Order> _orders = [
    const _Order(
      id: 'ORD-2402',
      createdAt: 'Today, 7:12 AM',
      branchName: 'Hotel Crescent - Main',
      statusLabel: 'In production',
      paymentModeLabel: 'Paid',
      total: 6480,
      stage: 1,
      items: ['40 x Multigrain Loaf', '2 x Butter Croissant'],
    ),
    const _Order(
      id: 'ORD-2398',
      createdAt: 'Yesterday, 8:43 AM',
      branchName: 'Hotel Crescent - Main',
      statusLabel: 'Delivered',
      paymentModeLabel: 'Credit',
      total: 9300,
      stage: 3,
      items: ['18 x Brioche Buns', '12 x Pav Buns', '1 x Plum Cake'],
    ),
  ];
  final List<_StandingOrder> _standingOrders = [];
  final List<_StandingOrderChange> _standingOrderChanges = [];
  final List<_RecurrenceRule> _recurrenceRules = [];
  final List<_CustomerPricingRule> _pricingRules = [];
  final List<_CreditHoldEvent> _creditHolds = [];
  final List<_CreditLedgerEntry> _creditLedgerEntries = [];
  final List<_SubstitutionRule> _substitutionRules = [];
  final List<_SubstitutionEvent> _substitutionEvents = [];
  final List<_CustomerBranch> _branches = [
    const _CustomerBranch(
      id: 'branch-main',
      name: 'Hotel Crescent - Main',
      code: 'HC-MAIN',
      serviceZone: 'Kochi Central',
      status: 'active',
      deliveryNotes: 'Gate 2, Service Lane, Marine Drive',
    ),
    const _CustomerBranch(
      id: 'branch-kitchen',
      name: 'Hotel Crescent - Kitchen Dock',
      code: 'HC-DOCK',
      serviceZone: 'Kochi Central',
      status: 'paused',
      deliveryNotes: 'Currently paused for renovation.',
    ),
  ];
  final List<_CustomerUser> _customerUsers = [
    const _CustomerUser(
      id: 'cust-user-owner',
      displayName: 'Anand Menon',
      role: 'admin',
      status: 'active',
      branchId: 'branch-main',
    ),
    const _CustomerUser(
      id: 'cust-user-buyer',
      displayName: 'Procurement Desk',
      role: 'buyer',
      status: 'active',
      branchId: 'branch-main',
    ),
  ];

  final GlobalKey<ScaffoldMessengerState> _messengerKey =
      GlobalKey<ScaffoldMessengerState>();

  Timer? _countdownTimer;

  _JourneyPhase _phase = _JourneyPhase.splash;
  _HomeTab _tab = _HomeTab.home;
  int _onboardStep = 0;
  int _cutoffSeconds = 2 * 3600 + 41 * 60 + 18;
  int _selectedDateIndex = 1;
  int _selectedSlotIndex = 0;
  String _selectedCategory = 'All';
  String _paymentMode = 'prepaid';
  int _partPaymentPercent = 30;
  bool _otpSent = false;
  String? _otpChallengeId;
  String? _otpPreviewCode;
  String? _otpVerificationToken;
  final TextEditingController _otpController = TextEditingController();
  bool _gstVerified = false;
  bool _standingSkipped = false;
  String _businessType = 'Hotel';
  String _creditChoice = 'credit';
  int _requestedCreditLimit = 50000;
  int _requestedCreditDays = 15;
  String _accountTier = 'Tier A';
  bool _cloudStorageEnabled = false;
  final Set<String> _uploadedDocs = <String>{};
  Map<String, int> _cart = <String, int>{};
  String? _sessionToken;
  String? _customerId;
  String _selectedBranchId = 'branch-main';
  final Set<int> _standingDays = <int>{1, 2, 3, 4, 5};
  final TextEditingController _standingNotesController = TextEditingController(
    text: 'Weekday repeat',
  );
  final TextEditingController _standingChangeReasonController = TextEditingController(
    text: 'Please review this standing order update.',
  );
  final TextEditingController _newBranchNameController = TextEditingController();
  final TextEditingController _newBranchCodeController = TextEditingController();
  final TextEditingController _newBranchNotesController = TextEditingController();
  final TextEditingController _inviteNameController = TextEditingController();
  final TextEditingController _invitePhoneController = TextEditingController();
  final TextEditingController _inviteEmailController = TextEditingController();
  String _inviteRole = 'viewer';
  String? _inviteBranchId = 'branch-main';

  @override
  void initState() {
    super.initState();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted || _phase.index < _JourneyPhase.home.index) {
        return;
      }
      setState(() {
        _cutoffSeconds = _cutoffSeconds > 0 ? _cutoffSeconds - 1 : 0;
      });
    });
    _loadStorageStatus();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    _phoneController.dispose();
    _otpController.dispose();
    _businessController.dispose();
    _contactController.dispose();
    _addressController.dispose();
    _cityController.dispose();
    _pinController.dispose();
    _instructionsController.dispose();
    _gstController.dispose();
    _standingNotesController.dispose();
    _standingChangeReasonController.dispose();
    _newBranchNameController.dispose();
    _newBranchCodeController.dispose();
    _newBranchNotesController.dispose();
    _inviteNameController.dispose();
    _invitePhoneController.dispose();
    _inviteEmailController.dispose();
    super.dispose();
  }

  Future<void> _loadStorageStatus() async {
    try {
      final response = await http.get(Uri.parse('$_apiBaseUrl/storage/status'));
      if (!mounted || response.statusCode < 200 || response.statusCode >= 300) {
        return;
      }
      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      if (!mounted) {
        return;
      }
      setState(() {
        _cloudStorageEnabled = payload['uploadStorageEnabled'] == true;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _cloudStorageEnabled = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScaffoldMessenger(
      key: _messengerKey,
      child: MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'Aeden Bakes Customer',
        theme: _buildAedenTheme(),
        home: AnimatedSwitcher(
          duration: const Duration(milliseconds: 320),
          transitionBuilder: (child, animation) {
            return FadeTransition(
              opacity: animation,
              child: SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0.04, 0),
                  end: Offset.zero,
                ).animate(animation),
                child: child,
              ),
            );
          },
          child: KeyedSubtree(
            key: ValueKey(_phase.name),
            child: switch (_phase) {
              _JourneyPhase.splash => _buildSplashScreen(),
              _JourneyPhase.auth => _buildAuthScreen(),
              _JourneyPhase.onboard => _buildOnboardingScreen(),
              _JourneyPhase.review => _buildReviewScreen(),
              _JourneyPhase.approved => _buildApprovedScreen(),
              _JourneyPhase.home => _buildHomeShell(),
            },
          ),
        ),
      ),
    );
  }

  void _showMessage(String message) {
    _messengerKey.currentState
      ?..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          behavior: SnackBarBehavior.floating,
          backgroundColor: AedenPalette.ink,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      );
  }

  String _extractApiError(http.Response response, String fallback) {
    try {
      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      return payload['error'] as String? ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  void _advanceFromSplash() {
    setState(() {
      _phase = _JourneyPhase.auth;
    });
  }

  Future<void> _sendOtpOrContinue() async {
    FocusScope.of(context).unfocus();
    if (!_otpSent) {
      final phone = _phoneController.text.replaceAll(RegExp(r'\D'), '');
      if (phone.length < 10) {
        _showMessage('Enter a valid business mobile number');
        return;
      }

      try {
        final response = await http.post(
          Uri.parse('$_apiBaseUrl/auth/otp/request'),
          headers: const {'Content-Type': 'application/json'},
          body: '{"phone":"$phone"}',
        );
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw Exception('OTP request failed with status ${response.statusCode}');
        }
        final payload = response.body.isNotEmpty
            ? (jsonDecode(response.body) as Map<String, dynamic>)
            : <String, dynamic>{};
        setState(() {
          _otpSent = true;
          _otpChallengeId = payload['challengeId'] as String?;
          _otpPreviewCode = payload['debugCode'] as String?;
        });
        if (_otpPreviewCode != null) {
          _showMessage('OTP sent. Local test code: $_otpPreviewCode');
        } else {
          _showMessage('OTP sent to +91 $phone');
        }
      } catch (error) {
        _showMessage(error.toString());
      }
      return;
    }

    final challengeId = _otpChallengeId;
    final phone = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    final code = _otpController.text.trim();
    if (challengeId == null || code.length != 6) {
      _showMessage('Enter the 6-digit code');
      return;
    }

    try {
      final response = await http.post(
        Uri.parse('$_apiBaseUrl/auth/otp/verify'),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode({
          'challengeId': challengeId,
          'phone': phone,
          'code': code,
        }),
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final message = _extractApiError(response, 'OTP verification failed');
        throw Exception(message);
      }

      setState(() {
        _phase = _JourneyPhase.onboard;
        _onboardStep = 0;
        _otpVerificationToken = response.body.isNotEmpty
            ? (jsonDecode(response.body) as Map<String, dynamic>)['otpToken'] as String?
            : null;
      });
    } catch (error) {
      _showMessage(error.toString());
    }
  }

  void _nextOnboardingStep() {
    FocusScope.of(context).unfocus();
    if (_onboardStep < 3) {
      setState(() {
        _onboardStep += 1;
      });
      return;
    }

    setState(() {
      _phase = _JourneyPhase.review;
    });
  }

  Future<void> _approveApplication() async {
    await _submitApplication();
  }

  void _enterApp() {
    setState(() {
      _phase = _JourneyPhase.home;
      _tab = _HomeTab.home;
    });
    _showMessage('Welcome back, ${_businessController.text}');
  }

  void _changeTab(_HomeTab tab) {
    setState(() {
      _tab = tab;
    });
  }

  Future<void> _submitApplication() async {
    try {
      final otpToken = _otpVerificationToken;
      final response = await http.post(
        Uri.parse('$_apiBaseUrl/customer/onboard'),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode({
          'name': _businessController.text.trim(),
          'deliveryZone': 'Kochi Central',
          'loginId': _phoneController.text.replaceAll(RegExp(r'\D'), ''),
          'defaultAddress': _addressController.text.trim(),
          'otpToken': otpToken,
          'tier': _accountTier,
          'creditLimit': _requestedCreditLimit,
        }),
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception(_extractApiError(response, 'Could not submit application'));
      }
      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      final token = payload['token'] as String?;
      if (token != null) {
        _sessionToken = token;
      }
      _customerId = (payload['user'] as Map<String, dynamic>?)?['customerId'] as String?;
      await _syncCustomerFromApi();
      if (!mounted) {
        return;
      }
      setState(() {
        _phase = _JourneyPhase.approved;
        _accountTier = _creditChoice == 'credit' ? 'Tier A' : 'Prepaid';
      });
    } catch (error) {
      _showMessage(error.toString());
    }
  }

  Future<void> _syncCustomerFromApi() async {
    final token = _sessionToken;
    if (token == null) {
      return;
    }

    try {
      final dashboardResponse = await http.get(
        Uri.parse('$_apiBaseUrl/customer/dashboard'),
        headers: _authHeaders(),
      );
      if (dashboardResponse.statusCode >= 200 && dashboardResponse.statusCode < 300) {
        final payload = jsonDecode(dashboardResponse.body) as Map<String, dynamic>;
        _applyDashboard(payload);
      }

      final standingOrdersResponse = await http.get(
        Uri.parse('$_apiBaseUrl/customer/standing-orders'),
        headers: _authHeaders(),
      );
      if (standingOrdersResponse.statusCode >= 200 && standingOrdersResponse.statusCode < 300) {
        final payload = jsonDecode(standingOrdersResponse.body) as Map<String, dynamic>;
        _applyStandingOrders(payload);
      }
    } catch (_) {
      // Demo mode can continue if sync fails.
    }
  }

  void _applyDashboard(Map<String, dynamic> payload) {
    final existingBranches = List<_CustomerBranch>.from(_branches);
    final existingUsers = List<_CustomerUser>.from(_customerUsers);
    final existingOrders = List<_Order>.from(_orders);
    final branches = (payload['branches'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (branch) => _CustomerBranch(
            id: branch['id'] as String? ?? '',
            name: branch['name'] as String? ?? '',
            code: branch['code'] as String? ?? '',
            serviceZone: branch['serviceZone'] as String? ?? '',
            status: branch['status'] as String? ?? 'active',
            deliveryNotes: branch['deliveryNotes'] as String?,
          ),
        )
        .where((branch) => branch.id.isNotEmpty)
        .toList(growable: false);

    final users = (payload['users'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (user) => _CustomerUser(
            id: user['id'] as String? ?? '',
            displayName: user['displayName'] as String? ?? '',
            role: user['role'] as String? ?? 'viewer',
            status: user['status'] as String? ?? 'invited',
            branchId: user['branchId'] as String?,
            phone: user['phone'] as String?,
            email: user['email'] as String?,
          ),
        )
        .where((user) => user.id.isNotEmpty)
        .toList(growable: false);

    final orders = (payload['orders'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (order) => _Order(
            id: order['id'] as String? ?? '',
            createdAt: order['createdAt'] as String? ?? '',
            branchName: branches.firstWhere(
              (branch) => branch.id == order['branchId'],
              orElse: () => branches.isNotEmpty
                  ? branches.first
                  : const _CustomerBranch(
                      id: 'branch-fallback',
                      name: 'Main',
                      code: 'MAIN',
                      serviceZone: 'Kochi Central',
                      status: 'active',
                    ),
            ).name,
            statusLabel: order['status'] as String? ?? 'confirmed',
            paymentModeLabel: order['paymentMode'] as String? ?? 'Prepaid',
            total: (order['amountTotal'] as num?)?.round() ?? 0,
            stage: 1,
            items: (order['items'] as List<dynamic>? ?? const [])
                .whereType<Map<String, dynamic>>()
                .map(
                  (item) => '${item['quantity'] ?? 0} x ${item['productId'] ?? ''}',
                )
                .toList(growable: false),
          ),
        )
        .where((order) => order.id.isNotEmpty)
        .toList(growable: false);

    final pricingRules = (payload['pricingRules'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (entry) => _CustomerPricingRule(
            id: entry['id'] as String? ?? '',
            customerId: entry['customerId'] as String?,
            branchId: entry['branchId'] as String?,
            productId: entry['productId'] as String?,
            price: (entry['price'] as num?)?.round() ?? 0,
            pricingMode: entry['pricingMode'] as String? ?? 'fixed',
            status: entry['status'] as String? ?? 'active',
            reason: entry['reason'] as String?,
          ),
        )
        .where((entry) => entry.id.isNotEmpty)
        .toList(growable: false);

    final creditHolds = (payload['creditHolds'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (entry) => _CreditHoldEvent(
            id: entry['id'] as String? ?? '',
            customerId: entry['customerId'] as String? ?? '',
            branchId: entry['branchId'] as String?,
            status: entry['status'] as String? ?? 'active',
            reason: entry['reason'] as String? ?? '',
            createdAt: entry['createdAt'] as String? ?? '',
            releasedAt: entry['releasedAt'] as String?,
          ),
        )
        .where((entry) => entry.id.isNotEmpty)
        .toList(growable: false);

    final creditLedgerEntries = (payload['creditLedgerEntries'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (entry) => _CreditLedgerEntry(
            id: entry['id'] as String? ?? '',
            customerId: entry['customerId'] as String? ?? '',
            branchId: entry['branchId'] as String?,
            entryType: entry['entryType'] as String? ?? 'invoice',
            amount: (entry['amount'] as num?)?.round() ?? 0,
            balanceAfter: (entry['balanceAfter'] as num?)?.round() ?? 0,
            referenceType: entry['referenceType'] as String? ?? '',
            referenceId: entry['referenceId'] as String? ?? '',
            note: entry['note'] as String?,
            createdAt: entry['createdAt'] as String? ?? '',
          ),
        )
        .where((entry) => entry.id.isNotEmpty)
        .toList(growable: false);

    final substitutionRules = (payload['substitutionRules'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (entry) => _SubstitutionRule(
            id: entry['id'] as String? ?? '',
            customerId: entry['customerId'] as String?,
            branchId: entry['branchId'] as String?,
            productId: entry['productId'] as String? ?? '',
            substituteProductId: entry['substituteProductId'] as String? ?? '',
            status: entry['status'] as String? ?? 'active',
            reason: entry['reason'] as String? ?? '',
          ),
        )
        .where((entry) => entry.id.isNotEmpty)
        .toList(growable: false);

    final substitutionEvents = (payload['substitutionEvents'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (entry) => _SubstitutionEvent(
            id: entry['id'] as String? ?? '',
            customerId: entry['customerId'] as String? ?? '',
            branchId: entry['branchId'] as String?,
            orderId: entry['orderId'] as String?,
            productId: entry['productId'] as String? ?? '',
            substituteProductId: entry['substituteProductId'] as String? ?? '',
            status: entry['status'] as String? ?? 'proposed',
            reason: entry['reason'] as String? ?? '',
            createdAt: entry['createdAt'] as String? ?? '',
          ),
        )
        .where((entry) => entry.id.isNotEmpty)
        .toList(growable: false);

    if (!mounted) {
      return;
    }
    setState(() {
      _branches
        ..clear()
        ..addAll(branches.isNotEmpty ? branches : existingBranches);
      _customerUsers
        ..clear()
        ..addAll(users.isNotEmpty ? users : existingUsers);
      _orders
        ..clear()
        ..addAll(orders.isNotEmpty ? orders : existingOrders);
      _pricingRules
        ..clear()
        ..addAll(pricingRules);
      _creditHolds
        ..clear()
        ..addAll(creditHolds);
      _creditLedgerEntries
        ..clear()
        ..addAll(creditLedgerEntries);
      _substitutionRules
        ..clear()
        ..addAll(substitutionRules);
      _substitutionEvents
        ..clear()
        ..addAll(substitutionEvents);
      if (_branches.isNotEmpty && !_branches.any((branch) => branch.id == _selectedBranchId)) {
        _selectedBranchId = _branches.first.id;
      }
    });
  }

  void _applyStandingOrders(Map<String, dynamic> payload) {
    final existingStandingOrders = List<_StandingOrder>.from(_standingOrders);
    final existingStandingOrderChanges = List<_StandingOrderChange>.from(_standingOrderChanges);
    final existingRecurrenceRules = List<_RecurrenceRule>.from(_recurrenceRules);
    final standingOrders = (payload['standingOrders'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (entry) => _StandingOrder(
            id: entry['id'] as String? ?? '',
            branchName: _branchNameFor(entry['branchId'] as String?),
            status: entry['status'] as String? ?? 'draft',
            slotLabel: entry['schedule'] is Map<String, dynamic>
                ? (entry['schedule'] as Map<String, dynamic>)['slotId'] as String? ?? ''
                : '',
            notes: entry['schedule'] is Map<String, dynamic>
                ? (entry['schedule'] as Map<String, dynamic>)['notes'] as String? ?? ''
                : '',
            deliveryDays: entry['schedule'] is Map<String, dynamic>
                ? ((entry['schedule'] as Map<String, dynamic>)['deliveryDays'] as List<dynamic>? ?? const [])
                    .whereType<num>()
                    .map((day) => day.toInt())
                    .toList(growable: false)
                : const [],
          ),
        )
        .where((entry) => entry.id.isNotEmpty)
        .toList(growable: false);

    final standingOrderChanges = (payload['standingOrderChanges'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (entry) => _StandingOrderChange(
            id: entry['id'] as String? ?? '',
            standingOrderId: entry['standingOrderId'] as String? ?? '',
            status: entry['status'] as String? ?? 'submitted',
            changeType: entry['changeType'] as String? ?? 'schedule_update',
            branchId: entry['branchId'] as String?,
            reason: entry['reason'] as String? ?? '',
            requestedBy: entry['requestedBy'] as String? ?? '',
            requestedAt: entry['requestedAt'] as String? ?? '',
            decidedBy: entry['decidedBy'] as String?,
            decidedAt: entry['decidedAt'] as String?,
          ),
        )
        .where((entry) => entry.id.isNotEmpty)
        .toList(growable: false);

    final recurrenceRules = (payload['recurrenceRules'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(
          (entry) => _RecurrenceRule(
            id: entry['id'] as String? ?? '',
            ruleCode: entry['ruleCode'] as String? ?? '',
            status: entry['status'] as String? ?? 'active',
            cadence: entry['cadence'] as String? ?? 'weekly',
            branchId: entry['branchId'] as String?,
            customerId: entry['customerId'] as String?,
            slotId: entry['payload'] is Map<String, dynamic>
                ? (entry['payload'] as Map<String, dynamic>)['slotId'] as String? ?? ''
                : '',
            branchScoped: entry['payload'] is Map<String, dynamic>
                ? (entry['payload'] as Map<String, dynamic>)['branchScoped'] as bool? ?? false
                : false,
            deliveryDays: entry['payload'] is Map<String, dynamic>
                ? ((entry['payload'] as Map<String, dynamic>)['deliveryDays'] as List<dynamic>? ?? const [])
                    .whereType<num>()
                    .map((day) => day.toInt())
                    .toList(growable: false)
                : const [],
            notes: entry['payload'] is Map<String, dynamic>
                ? (entry['payload'] as Map<String, dynamic>)['notes'] as String?
                : null,
          ),
        )
        .where((entry) => entry.id.isNotEmpty)
        .toList(growable: false);

    if (!mounted) {
      return;
    }
    setState(() {
      _standingOrders
        ..clear()
        ..addAll(standingOrders.isNotEmpty ? standingOrders : existingStandingOrders);
      _standingOrderChanges
        ..clear()
        ..addAll(standingOrderChanges.isNotEmpty ? standingOrderChanges : existingStandingOrderChanges);
      _recurrenceRules
        ..clear()
        ..addAll(recurrenceRules.isNotEmpty ? recurrenceRules : existingRecurrenceRules);
    });
  }

  String _branchNameFor(String? branchId) {
    if (branchId == null) {
      return _activeBranch().name;
    }
    for (final branch in _branches) {
      if (branch.id == branchId) {
        return branch.name;
      }
    }
    return _activeBranch().name;
  }

  Map<String, String> _authHeaders() {
    final token = _sessionToken;
    return token == null ? const {} : {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'};
  }

  _CustomerBranch _activeBranch() {
    return _branches.firstWhere(
      (branch) => branch.id == _selectedBranchId,
      orElse: () => _branches.first,
    );
  }

  void _selectBranch(String branchId) {
    final branch = _branches.where((entry) => entry.id == branchId).toList();
    if (branch.isEmpty) {
      _showMessage('Branch not found');
      return;
    }
    setState(() {
      _selectedBranchId = branchId;
      _selectedSlotIndex = 0;
    });
    _showMessage('${branch.first.name} selected');
  }

  void _addBranch() {
    final name = _newBranchNameController.text.trim();
    final code = _newBranchCodeController.text.trim().toUpperCase();
    final notes = _newBranchNotesController.text.trim();
    if (name.isEmpty || code.isEmpty) {
      _showMessage('Enter a branch name and code');
      return;
    }
    if (_branches.any((branch) => branch.code == code)) {
      _showMessage('Branch code already exists');
      return;
    }
    final customerId = _customerId;
    if (_sessionToken != null && customerId != null) {
      unawaited(() async {
        try {
          final response = await http.post(
            Uri.parse('$_apiBaseUrl/customers/$customerId/branches'),
            headers: _authHeaders(),
            body: jsonEncode({
              'name': name,
              'code': code,
              'serviceZone': _activeBranch().serviceZone,
              'deliveryNotes': notes,
            }),
          );
          if (response.statusCode < 200 || response.statusCode >= 300) {
            throw Exception(_extractApiError(response, 'Could not add branch'));
          }
          await _syncCustomerFromApi();
          if (!mounted) {
            return;
          }
          _newBranchNameController.clear();
          _newBranchCodeController.clear();
          _newBranchNotesController.clear();
          _showMessage('Branch added');
        } catch (error) {
          _showMessage(error.toString());
        }
      }());
      return;
    }

    final branch = _CustomerBranch(
      id: 'branch-${DateTime.now().millisecondsSinceEpoch}',
      name: name,
      code: code,
      serviceZone: _activeBranch().serviceZone,
      status: 'active',
      deliveryNotes: notes.isEmpty ? null : notes,
    );
    setState(() {
      _branches.insert(0, branch);
      _selectedBranchId = branch.id;
      _newBranchNameController.clear();
      _newBranchCodeController.clear();
      _newBranchNotesController.clear();
    });
    _showMessage('Branch added');
  }

  void _inviteUser() {
    final displayName = _inviteNameController.text.trim();
    final phone = _invitePhoneController.text.trim();
    final email = _inviteEmailController.text.trim();
    if (displayName.isEmpty) {
      _showMessage('Enter a user name');
      return;
    }
    final customerId = _customerId;
    if (_sessionToken != null && customerId != null) {
      unawaited(() async {
        try {
          final response = await http.post(
            Uri.parse('$_apiBaseUrl/customers/$customerId/users/invite'),
            headers: _authHeaders(),
            body: jsonEncode({
              'displayName': displayName,
              'branchId': _inviteBranchId,
              'role': _inviteRole,
              'phone': phone,
              'email': email,
            }),
          );
          if (response.statusCode < 200 || response.statusCode >= 300) {
            throw Exception(_extractApiError(response, 'Could not send invite'));
          }
          await _syncCustomerFromApi();
          if (!mounted) {
            return;
          }
          _inviteNameController.clear();
          _invitePhoneController.clear();
          _inviteEmailController.clear();
          _inviteRole = 'viewer';
          _inviteBranchId = _branches.isNotEmpty ? _branches.first.id : null;
          _showMessage('Invite queued');
        } catch (error) {
          _showMessage(error.toString());
        }
      }());
      return;
    }

    final user = _CustomerUser(
      id: 'cust-user-${DateTime.now().millisecondsSinceEpoch}',
      displayName: displayName,
      role: _inviteRole,
      status: 'invited',
      branchId: _inviteBranchId,
      phone: phone.isEmpty ? null : phone,
      email: email.isEmpty ? null : email,
    );
    setState(() {
      _customerUsers.insert(0, user);
      _inviteNameController.clear();
      _invitePhoneController.clear();
      _inviteEmailController.clear();
      _inviteRole = 'viewer';
      _inviteBranchId = _branches.isNotEmpty ? _branches.first.id : null;
    });
    _showMessage('Invite queued');
  }

  void _setCategory(String category) {
    setState(() {
      _selectedCategory = category;
    });
  }

  void _setDateIndex(int index) {
    setState(() {
      _selectedDateIndex = index;
    });
    _showMessage('${_dateLabels[index]} selected for delivery');
  }

  void _setSlotIndex(int index) {
    setState(() {
      _selectedSlotIndex = index;
    });
  }

  void _setPaymentMode(String mode) {
    setState(() {
      _paymentMode = mode;
    });
  }

  void _setPartPaymentPercent(int percent) {
    setState(() {
      _partPaymentPercent = percent;
    });
  }

  void _toggleStandingDay(int weekday) {
    setState(() {
      if (_standingDays.contains(weekday)) {
        _standingDays.remove(weekday);
      } else {
        _standingDays.add(weekday);
      }
    });
  }

  Future<void> _saveStandingOrder() async {
    if (_cart.isEmpty) {
      _showMessage('Add items to the cart first');
      return;
    }
    final branch = _activeBranch();
    final items = _cart.entries
        .map((entry) {
          final product = _catalog.firstWhere((item) => item.id == entry.key);
          return {'productId': product.id, 'quantity': entry.value};
        })
        .toList(growable: false);
    final payload = {
      'branchId': branch.id,
      'deliveryDays': _standingDays.toList()..sort(),
      'slotId': _slots[_selectedSlotIndex].id,
      'paymentMode': switch (_paymentMode) {
        'credit' => 'credit',
        'part' => 'part-pay',
        _ => 'prepaid',
      },
      'items': items,
      'notes': _standingNotesController.text.trim(),
    };

    if (_sessionToken != null) {
      try {
        final response = await http.post(
          Uri.parse('$_apiBaseUrl/customer/standing-orders'),
          headers: _authHeaders(),
          body: jsonEncode(payload),
        );
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw Exception(_extractApiError(response, 'Could not save standing order'));
        }
        await _syncCustomerFromApi();
        _showMessage('Standing order saved for ${branch.name}');
        return;
      } catch (error) {
        _showMessage(error.toString());
      }
    }

    final order = _StandingOrder(
      id: 'so-${DateTime.now().millisecondsSinceEpoch}',
      branchName: branch.name,
      status: 'draft',
      slotLabel: _slots[_selectedSlotIndex].label,
      deliveryDays: _standingDays.toList()..sort(),
      notes: _standingNotesController.text.trim(),
    );
    setState(() {
      _standingOrders.insert(0, order);
    });
    _showMessage('Standing order saved locally for ${branch.name}');
  }

  Future<void> _requestStandingOrderChange(_StandingOrder standingOrder) async {
    final reason = _standingChangeReasonController.text.trim();
    if (reason.isEmpty) {
      _showMessage('Add a reason for the change request');
      return;
    }

    final changeType = standingOrder.status == 'paused' ? 'resume' : 'pause';
    final payload = {
      'changeType': changeType,
      'reason': reason,
      'status': standingOrder.status == 'paused' ? 'active' : 'paused',
    };

    if (_sessionToken != null) {
      try {
        final response = await http.post(
          Uri.parse('$_apiBaseUrl/standing-orders/${standingOrder.id}/change-request'),
          headers: _authHeaders(),
          body: jsonEncode(payload),
        );
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw Exception(_extractApiError(response, 'Could not request standing order change'));
        }
        await _syncCustomerFromApi();
        _showMessage('Change request submitted');
        return;
      } catch (error) {
        _showMessage(error.toString());
      }
    }

    final change = _StandingOrderChange(
      id: 'soc-${DateTime.now().millisecondsSinceEpoch}',
      standingOrderId: standingOrder.id,
      status: 'submitted',
      changeType: changeType,
      branchId: _selectedBranchId,
      reason: reason,
      requestedBy: 'customer',
      requestedAt: DateTime.now().toIso8601String(),
      decidedBy: null,
      decidedAt: null,
    );
    setState(() {
      _standingOrderChanges.insert(0, change);
    });
    _showMessage('Change request submitted locally');
  }

  void _addProduct(String productId) {
    final remaining = _remainingFor(productId);
    final current = _cart[productId] ?? 0;
    if (current >= remaining) {
      _showMessage('No more stock available for tomorrow');
      return;
    }

    setState(() {
      _cart[productId] = current + 1;
    });
  }

  void _removeProduct(String productId) {
    final current = _cart[productId] ?? 0;
    if (current <= 1) {
      setState(() {
        _cart.remove(productId);
      });
      return;
    }

    setState(() {
      _cart[productId] = current - 1;
    });
  }

  void _clearCart() {
    setState(() {
      _cart = <String, int>{};
    });
  }

  void _toggleDocument(String name) {
    setState(() {
      if (_uploadedDocs.contains(name)) {
        _uploadedDocs.remove(name);
      } else {
        _uploadedDocs.add(name);
      }
    });
  }

  int _remainingFor(String productId) {
    return _catalog.firstWhere((product) => product.id == productId).remaining;
  }

  int _priceFor(String productId) {
    final branchId = _selectedBranchId;
    final rule = _pricingRules.firstWhere(
      (entry) =>
          entry.status == 'active' &&
          entry.productId == productId &&
          (entry.branchId == null || entry.branchId == branchId) &&
          (entry.customerId == null || entry.customerId == _customerId),
      orElse: () => const _CustomerPricingRule(
        id: '',
        customerId: null,
        branchId: null,
        productId: null,
        price: 0,
        pricingMode: 'fixed',
        status: 'active',
        reason: null,
      ),
    );
    if (rule.id.isNotEmpty) {
      return rule.price;
    }
    return _catalog.firstWhere((product) => product.id == productId).price;
  }

  int _cartCount() {
    return _cart.values.fold<int>(0, (sum, value) => sum + value);
  }

  int _cartSubtotal() {
    int subtotal = 0;
    for (final entry in _cart.entries) {
      subtotal += _priceFor(entry.key) * entry.value;
    }
    return subtotal;
  }

  int _gstFor(int subtotal) => (subtotal * 0.05).round();

  int _deliveryFor(int subtotal) =>
      subtotal == 0 ? 0 : (subtotal >= 3000 ? 0 : 80);

  int _cartTotal() {
    final subtotal = _cartSubtotal();
    return subtotal + _gstFor(subtotal) + _deliveryFor(subtotal);
  }

  String _selectedDateLabel() {
    final today = DateTime.now();
    final tomorrow = today.add(const Duration(days: 1));
    final pick = DateTime(today.year, today.month, today.day + 3);
    final selected = switch (_selectedDateIndex) {
      0 => 'Today, ${_weekday(today.weekday)} ${today.day}',
      1 => 'Tomorrow, ${_weekday(tomorrow.weekday)} ${tomorrow.day}',
      _ => 'Pick date, ${_weekday(pick.weekday)} ${pick.day}',
    };
    return selected;
  }

  String _selectedServiceDateIso() {
    final today = DateTime.now();
    final date = switch (_selectedDateIndex) {
      0 => today,
      1 => today.add(const Duration(days: 1)),
      _ => DateTime(today.year, today.month, today.day + 3),
    };
    return DateTime(date.year, date.month, date.day).toIso8601String().substring(0, 10);
  }

  String _weekday(int weekday) {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return labels[(weekday - 1).clamp(0, 6)];
  }

  String _formatMoney(num value) {
    final amount = value.round();
    final sign = amount < 0 ? '-' : '';
    final raw = amount.abs().toString();
    if (raw.length <= 3) {
      return '₹$sign$raw';
    }
    final lastThree = raw.substring(raw.length - 3);
    final rest = raw.substring(0, raw.length - 3);
    final groupedRest = rest.replaceAllMapped(
      RegExp(r'\B(?=(\d{2})+(?!\d))'),
      (match) => ',',
    );
    return '₹$sign$groupedRest,$lastThree';
  }

  String _countdownLabel() {
    final hours = _cutoffSeconds ~/ 3600;
    final minutes = (_cutoffSeconds % 3600) ~/ 60;
    final seconds = _cutoffSeconds % 60;
    return '$hours:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
  }

  Future<void> _openProductSheet(_Product product) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return Padding(
          padding: const EdgeInsets.fromLTRB(12, 24, 12, 12),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: AedenPalette.cream,
              borderRadius: BorderRadius.circular(30),
              boxShadow: const [
                BoxShadow(
                  color: Color.fromRGBO(28, 25, 23, 0.2),
                  blurRadius: 40,
                  offset: Offset(0, 18),
                ),
              ],
            ),
            child: Padding(
              padding: EdgeInsets.only(
                left: 18,
                right: 18,
                top: 12,
                bottom: 18 + MediaQuery.of(sheetContext).padding.bottom,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const _GrabHandle(),
                  const SizedBox(height: 10),
                  _ProductHero(product: product, compact: false),
                  const SizedBox(height: 14),
                  Text(
                    product.name,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${product.pack} · Order by ${product.cutoff} for next-day delivery',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 14),
                  Text(
                    product.note,
                    style: Theme.of(
                      context,
                    ).textTheme.bodyLarge?.copyWith(color: AedenPalette.ink),
                  ),
                  const SizedBox(height: 16),
                  _ContractRow(
                    label: 'Your contract price',
                    value: _formatMoney(_priceFor(product.id)),
                    tone: _ContractTone.gold,
                  ),
                  const SizedBox(height: 14),
                  FilledButton(
                    onPressed: () {
                      _addProduct(product.id);
                      Navigator.of(sheetContext).pop();
                      _showMessage('${product.name} added to cart');
                    },
                    child: Text(
                      'Add to cart · ${_formatMoney(_priceFor(product.id))}',
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Future<void> _submitOrder() async {
    if (_cart.isEmpty) {
      _showMessage('Add at least one item before placing an order');
      return;
    }

    final branch = _activeBranch();
    final total = _cartTotal();
    final selectedItems = _cart.entries
        .map((entry) {
          final product = _catalog.firstWhere((item) => item.id == entry.key);
          return {'productId': product.id, 'quantity': entry.value};
        })
        .toList(growable: false);

    final paymentMode = switch (_paymentMode) {
      'credit' => 'credit',
      'part' => 'part-pay',
      _ => 'prepaid',
    };

    if (_sessionToken != null) {
      try {
        final response = await http.post(
          Uri.parse('$_apiBaseUrl/customer/orders'),
          headers: _authHeaders(),
          body: jsonEncode({
            'serviceDate': _selectedServiceDateIso(),
            'slotId': _slots[_selectedSlotIndex].id,
            'branchId': branch.id,
            'paymentMode': paymentMode,
            'items': selectedItems,
          }),
        );
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw Exception(_extractApiError(response, 'Could not place order'));
        }
        final payload = jsonDecode(response.body) as Map<String, dynamic>;
        if (payload['dashboard'] is Map<String, dynamic>) {
          _applyDashboard(payload['dashboard'] as Map<String, dynamic>);
        }
        await _syncCustomerFromApi();
        if (!mounted) {
          return;
        }
        setState(() {
          _clearCart();
          _tab = _HomeTab.orders;
        });
        _showMessage('Order placed successfully for ${branch.name}');
        return;
      } catch (error) {
        _showMessage(error.toString());
      }
    }

    final orderId = 'ORD-${2403 + _orders.length}';
    final deliveryMoment = _selectedDateLabel();
    final slotLabel = _slots[_selectedSlotIndex].label;
    final localItems = _cart.entries
        .map((entry) {
          final product = _catalog.firstWhere((item) => item.id == entry.key);
          return '${entry.value} x ${product.name}';
        })
        .toList(growable: false);
    final partPaymentLabel = _partPaymentPercent.toString();
    final paymentLabel = switch (_paymentMode) {
      'credit' => 'Credit',
      'part' => 'Part-paid $partPaymentLabel%',
      _ => 'Paid',
    };

    setState(() {
      _orders.insert(
        0,
        _Order(
          id: orderId,
          createdAt: '$deliveryMoment · $slotLabel',
          branchName: branch.name,
          statusLabel: 'In production',
          paymentModeLabel: paymentLabel,
          total: total,
          stage: 1,
          items: localItems,
        ),
      );
      _clearCart();
      _tab = _HomeTab.orders;
    });

    _showMessage('Order placed successfully for ${branch.name}');
  }

  Widget _buildSplashScreen() {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF241A11), Color(0xFF1A1209), Color(0xFF140D07)],
          ),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            const _DarkOrbs(),
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            'Est. 2026 \u00B7 Kochi',
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.labelLarge
                                ?.copyWith(
                                  color: AedenPalette.goldLight,
                                  letterSpacing: 1.6,
                                  fontSize: 9.2,
                                ),
                          ),
                        ),
                      ],
                    ),
                    Expanded(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const _SealMark(),
                          const SizedBox(height: 18),
                          Text(
                            'Aeden Bakes',
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.displayMedium
                                ?.copyWith(
                                  color: AedenPalette.ivory,
                                  fontWeight: FontWeight.w600,
                                  height: 1.05,
                                ),
                          ),
                          const SizedBox(height: 12),
                          _GoldenRule(color: AedenPalette.goldLight),
                          const SizedBox(height: 14),
                          Text(
                            'Wholesale bakery for fine kitchens.\nBook tonight, baked and delivered\nto your dock by morning.',
                            textAlign: TextAlign.center,
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(
                                  color: AedenPalette.goldMuted,
                                  height: 1.7,
                                ),
                          ),
                          const SizedBox(height: 22),
                          Wrap(
                            alignment: WrapAlignment.center,
                            spacing: 8,
                            runSpacing: 8,
                            children: const [
                              _PremiumBadge(text: 'FSSAI CERTIFIED'),
                              _PremiumBadge(text: 'GST INVOICING'),
                              _PremiumBadge(text: 'CREDIT TERMS'),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 24),
                      child: Column(
                        children: [
                          FilledButton(
                            onPressed: _advanceFromSplash,
                            style: FilledButton.styleFrom(
                              backgroundColor: AedenPalette.goldBright,
                              foregroundColor: AedenPalette.ink,
                              minimumSize: const Size.fromHeight(54),
                            ),
                            child: const Text('Get started'),
                          ),
                          const SizedBox(height: 10),
                          OutlinedButton(
                            onPressed: _advanceFromSplash,
                            style: OutlinedButton.styleFrom(
                              minimumSize: const Size.fromHeight(52),
                              foregroundColor: AedenPalette.ivory,
                              side: BorderSide(
                                color: Colors.white.withValues(alpha: 0.16),
                              ),
                              backgroundColor: Colors.white.withValues(
                                alpha: 0.04,
                              ),
                            ),
                            child: const Text('I already have an account'),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAuthScreen() {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            const _CreamBackdrop(),
            SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 10),
                  Text(
                    'Step 1 \u00B7 Verify',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: AedenPalette.gold,
                      letterSpacing: 2.4,
                      fontSize: 10.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Let\u2019s get your business on board',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                      height: 1.06,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Enter your business mobile number. We\u2019ll send a one-time password to verify it\u2019s you.',
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 20),
                  _LabelCapsule(
                    label: 'Mobile number',
                    child: Row(
                      children: [
                        const _CountryChip(),
                        const SizedBox(width: 10),
                        Expanded(
                          child: TextField(
                            controller: _phoneController,
                            keyboardType: TextInputType.phone,
                            decoration: const InputDecoration(
                              hintText: '98470 12345',
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 240),
                    child: _otpSent
                        ? Column(
                            key: const ValueKey('otp-visible'),
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _LabelCapsule(
                                label: 'Verification code',
                                child: TextField(
                                  controller: _otpController,
                                  keyboardType: TextInputType.number,
                                  maxLength: 6,
                                  decoration: const InputDecoration(
                                    hintText: '6-digit code',
                                    counterText: '',
                                  ),
                                ),
                              ),
                              const SizedBox(height: 12),
                              if (_otpPreviewCode != null)
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: AedenPalette.goldSoft,
                                    border: Border.all(
                                      color: AedenPalette.goldLine,
                                    ),
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                  child: Text(
                                    'Local test code: $_otpPreviewCode',
                                    textAlign: TextAlign.center,
                                    style: Theme.of(context).textTheme.bodySmall
                                        ?.copyWith(color: AedenPalette.brown),
                                  ),
                                ),
                              const SizedBox(height: 12),
                              Text(
                                'Enter the code sent to +91 ${_phoneController.text}',
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: AedenPalette.grey),
                              ),
                            ],
                          )
                        : const SizedBox(key: ValueKey('otp-hidden')),
                  ),
                  const SizedBox(height: 14),
                  const _SecureNote(),
                  const SizedBox(height: 26),
                  _PremiumSectionCard(
                    title: 'Why this step matters',
                    subtitle:
                        'Aeden uses the mobile number for order updates, invoice delivery, and account security.',
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: const [
                        _PremiumBadge(text: 'OTP VERIFIED'),
                        _PremiumBadge(text: 'ORDER UPDATES'),
                        _PremiumBadge(text: 'SECURE CHECKOUT'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 26),
                  FilledButton(
                    onPressed: _sendOtpOrContinue,
                    child: Text(_otpSent ? 'Verify and continue' : 'Send OTP'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
  Widget _buildOnboardingScreen() {
    final stepTitles = <String>[
      'Your business',
      'Delivery address',
      'KYC documents',
      'Payment and credit',
    ];

    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            const _CreamBackdrop(),
            Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 14, 24, 0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Business onboarding',
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: AedenPalette.gold,
                          letterSpacing: 1.8,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 2, 24, 0),
                  child: _StepProgress(currentStep: _onboardStep),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 12, 24, 0),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Step ${_onboardStep + 1} of 4 · ${stepTitles[_onboardStep]}',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: AedenPalette.gold,
                        letterSpacing: 1.6,
                        fontSize: 10.5,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(24, 0, 24, 0),
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 280),
                      child: switch (_onboardStep) {
                        0 => _OnboardStepCard(
                          key: const ValueKey('business'),
                          title: 'Tell us about your\nbusiness',
                          subtitle:
                              'This sets up your wholesale account and GST invoicing.',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              TextField(
                                controller: _businessController,
                                decoration: const InputDecoration(
                                  labelText: 'Business name',
                                ),
                              ),
                              const SizedBox(height: 14),
                              Text(
                                'Business type',
                                style: Theme.of(context).textTheme.labelLarge
                                    ?.copyWith(color: AedenPalette.grey),
                              ),
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: _businessTypes
                                    .map((type) {
                                      final selected = type == _businessType;
                                      return ChoiceChip(
                                        selected: selected,
                                        label: Text(type),
                                        onSelected: (_) {
                                          setState(() {
                                            _businessType = type;
                                          });
                                        },
                                      );
                                    })
                                    .toList(growable: false),
                              ),
                              const SizedBox(height: 14),
                              TextField(
                                controller: _contactController,
                                decoration: const InputDecoration(
                                  labelText: 'Contact person',
                                ),
                              ),
                            ],
                          ),
                        ),
                        1 => _OnboardStepCard(
                          key: const ValueKey('address'),
                          title: 'Where do we\ndeliver?',
                          subtitle:
                              'Your zone decides available delivery slots and cutoff timing.',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              TextField(
                                controller: _addressController,
                                decoration: const InputDecoration(
                                  labelText: 'Address',
                                ),
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: TextField(
                                      controller: _cityController,
                                      decoration: const InputDecoration(
                                        labelText: 'City',
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: TextField(
                                      controller: _pinController,
                                      decoration: const InputDecoration(
                                        labelText: 'PIN code',
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              TextField(
                                controller: _instructionsController,
                                decoration: const InputDecoration(
                                  labelText: 'Receiving instructions',
                                ),
                              ),
                              const SizedBox(height: 12),
                              const _SuccessCallout(
                                title: 'Zone detected: Kochi Central',
                                subtitle: '3 delivery slots daily',
                              ),
                            ],
                          ),
                        ),
                        2 => _OnboardStepCard(
                          key: const ValueKey('kyc'),
                          title: 'Verify your\nbusiness · KYC',
                          subtitle:
                              'Required once. Unlocks contract pricing and credit terms.',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'GSTIN',
                                style: Theme.of(context).textTheme.labelLarge
                                    ?.copyWith(color: AedenPalette.grey),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Expanded(
                                    child: TextField(
                                      controller: _gstController,
                                      decoration: const InputDecoration(
                                        hintText: '32AAACH1234F1Z9',
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  FilledButton(
                                    onPressed: () {
                                      setState(() {
                                        _gstVerified = true;
                                      });
                                      _showMessage('GSTIN verified with GSTN');
                                    },
                                    style: FilledButton.styleFrom(
                                      minimumSize: const Size(92, 52),
                                    ),
                                    child: Text(
                                      _gstVerified ? 'Verified' : 'Verify',
                                    ),
                                  ),
                                ],
                              ),
                              if (_gstVerified) ...[
                                const SizedBox(height: 10),
                                const _SuccessCallout(
                                  title: 'Verified',
                                  subtitle: 'HOTEL CRESCENT PVT LTD · Active',
                                ),
                              ],
                              const SizedBox(height: 14),
                              Text(
                                'Documents',
                                style: Theme.of(context).textTheme.labelLarge
                                    ?.copyWith(color: AedenPalette.grey),
                              ),
                              const SizedBox(height: 8),
                              if (!_cloudStorageEnabled) ...[
                                const _InfoBanner(
                                  title: 'Demo storage mode',
                                  subtitle:
                                      'R2 is not connected yet, so document uploads stay local for the demo. Once storage is enabled, this step will sync to cloud storage.',
                                ),
                                const SizedBox(height: 10),
                              ],
                              ..._documentNames.map((name) {
                                final done = _uploadedDocs.contains(name);
                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: _UploadTile(
                                    name: name,
                                    note: name == 'FSSAI license'
                                        ? 'Required for food businesses'
                                        : (name == 'Cancelled cheque'
                                              ? 'For refunds and credit notes'
                                              : 'PDF or photo · max 5 MB'),
                                    uploaded: done,
                                    onTap: () {
                                      _toggleDocument(name);
                                      _showMessage(
                                        done
                                            ? '$name removed'
                                            : '$name uploaded',
                                      );
                                    },
                                  ),
                                );
                              }),
                            ],
                          ),
                        ),
                        _ => _OnboardStepCard(
                          key: const ValueKey('credit'),
                          title: 'How will you\npay?',
                          subtitle:
                              'You can change this later. Credit is subject to Aeden approval.',
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _PaymentChoiceCard(
                                title: 'Prepaid account',
                                subtitle:
                                    'Pay per order via UPI, card, or net banking.',
                                selected: _creditChoice == 'prepaid',
                                onTap: () {
                                  setState(() {
                                    _creditChoice = 'prepaid';
                                  });
                                },
                              ),
                              const SizedBox(height: 12),
                              _PaymentChoiceCard(
                                title: 'Apply for credit terms',
                                subtitle:
                                    'Order now, pay on invoice within your approved period.',
                                selected: _creditChoice == 'credit',
                                accent: true,
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const SizedBox(height: 10),
                                    Text(
                                      'Requested limit',
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelLarge
                                          ?.copyWith(
                                            color: AedenPalette.brown,
                                            letterSpacing: 1.2,
                                            fontSize: 10,
                                          ),
                                    ),
                                    const SizedBox(height: 8),
                                    Wrap(
                                      spacing: 8,
                                      children: [25000, 50000, 100000]
                                          .map((limit) {
                                            final selected =
                                                limit == _requestedCreditLimit;
                                            return ChoiceChip(
                                              selected: selected,
                                              label: Text(
                                                '\u20B9${(limit / 1000).round()}K', 
                                              ),
                                              onSelected: (_) {
                                                setState(() {
                                                  _requestedCreditLimit = limit;
                                                  _creditChoice = 'credit';
                                                });
                                              },
                                            );
                                          })
                                          .toList(growable: false),
                                    ),
                                    const SizedBox(height: 12),
                                    Text(
                                      'Credit period',
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelLarge
                                          ?.copyWith(
                                            color: AedenPalette.brown,
                                            letterSpacing: 1.2,
                                            fontSize: 10,
                                          ),
                                    ),
                                    const SizedBox(height: 8),
                                    Wrap(
                                      spacing: 8,
                                      children: [7, 15, 30]
                                          .map((days) {
                                            final selected =
                                                days == _requestedCreditDays;
                                            return ChoiceChip(
                                              selected: selected,
                                              label: Text('$days days'),
                                              onSelected: (_) {
                                                setState(() {
                                                  _requestedCreditDays = days;
                                                  _creditChoice = 'credit';
                                                });
                                              },
                                            );
                                          })
                                          .toList(growable: false),
                                    ),
                                  ],
                                ),
                                onTap: () {
                                  setState(() {
                                    _creditChoice = 'credit';
                                  });
                                },
                              ),
                            ],
                          ),
                        ),
                      },
                    ),
                  ),
                ),
                Padding(
                  padding: EdgeInsets.fromLTRB(
                    24,
                    8,
                    24,
                    18 + MediaQuery.of(context).padding.bottom,
                  ),
                  child: FilledButton(
                    onPressed: _nextOnboardingStep,
                    child: Text(
                      _onboardStep == 3 ? 'Submit for review' : 'Continue',
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReviewScreen() {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            const _CreamBackdrop(),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
              child: Column(
                children: [
                  const Spacer(),
                  const _PulseRing(),
                  const SizedBox(height: 12),
                  Text(
                    'Application submitted',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    _cloudStorageEnabled
                        ? 'Aeden Bakes is reviewing your business details and documents. Most accounts are approved within 2 working hours.'
                        : 'Aeden Bakes is reviewing your business details. Document uploads are running in demo mode until cloud storage is enabled.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 16),
                  _PremiumSectionCard(
                    title: 'Review snapshot',
                    subtitle:
                        'The kitchen now has everything needed to approve the account.',
                    child: Column(
                      children: [
                        _ReviewRow(
                          label: 'Business',
                          value: _businessController.text,
                        ),
                        _ReviewRow(
                          label: 'GSTIN',
                          value:
                              '${_gstController.text}${_gstVerified ? " \u2713" : ""}',
                        ),
                        _ReviewRow(
                          label: 'Delivery zone',
                          value: 'Kochi Central',
                        ),
                        _ReviewRow(
                          label: 'Documents',
                          value: _cloudStorageEnabled
                              ? '${_uploadedDocs.length} of 3 uploaded'
                              : '${_uploadedDocs.length} of 3 attached locally',
                        ),
                        _ReviewRow(
                          label: 'Requested',
                          value: _creditChoice == 'credit'
                              ? 'Credit · ${_formatMoney(_requestedCreditLimit)} · $_requestedCreditDays days'
                              : 'Prepaid account',
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: _approveApplication,
                    style: FilledButton.styleFrom(
                      backgroundColor: AedenPalette.ink,
                      foregroundColor: AedenPalette.ivory,
                    ),
                    child: const Text('Submit for review'),
                  ),
                  const Spacer(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildApprovedScreen() {
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            const _CreamBackdrop(),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 22),
              child: Column(
                children: [
                  const Spacer(),
                  const _ApprovalMark(),
                  const SizedBox(height: 10),
                  Text(
                    'You are approved!',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Welcome to Aeden Bakes wholesale. Your contract pricing and credit terms are now active.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 16),
                  _TierCard(
                    businessName: _businessController.text,
                    tier: _accountTier,
                    creditLimit: _requestedCreditLimit,
                    creditDays: _requestedCreditDays,
                  ),
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: _enterApp,
                    child: const Text('Start ordering'),
                  ),
                  const Spacer(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHomeShell() {
    final content = switch (_tab) {
      _HomeTab.home => _buildHomeTab(),
      _HomeTab.cart => _buildCartTab(),
      _HomeTab.orders => _buildOrdersTab(),
      _HomeTab.account => _buildAccountTab(),
    };

    return Scaffold(
      body: Stack(
        children: [
          const _CreamBackdrop(bright: true),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 260),
            child: KeyedSubtree(key: ValueKey(_tab.name), child: content),
          ),
          if (_tab == _HomeTab.home && _cartCount() > 0)
            Positioned(
              left: 16,
              right: 16,
              bottom: 92 + MediaQuery.of(context).padding.bottom,
              child: GestureDetector(
                onTap: () => _changeTab(_HomeTab.cart),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                  decoration: BoxDecoration(
                    color: AedenPalette.ink,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: const [
                      BoxShadow(
                        color: Color.fromRGBO(28, 25, 23, 0.28),
                        blurRadius: 24,
                        offset: Offset(0, 14),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '${_cartCount()} item${_cartCount() == 1 ? '' : 's'}',
                            style: Theme.of(context).textTheme.labelLarge
                                ?.copyWith(
                                  color: AedenPalette.goldMuted,
                                  fontSize: 11.5,
                                ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _formatMoney(_cartTotal()),
                            style: Theme.of(context).textTheme.titleMedium
                                ?.copyWith(
                                  color: AedenPalette.ivory,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ],
                      ),
                      Text(
                        'View cart',
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: AedenPalette.goldBright,
                          fontSize: 12.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: _BottomNav(tab: _tab, onChanged: _changeTab),
          ),
        ],
      ),
    );
  }

  Widget _buildHomeTab() {
    final filteredProducts = _selectedCategory == 'All'
        ? _catalog
        : _catalog
              .where((product) => product.category == _selectedCategory)
              .toList(growable: false);

    return SafeArea(
      bottom: false,
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          18,
          22,
          18,
          110 + MediaQuery.of(context).padding.bottom,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _HomeHeader(
              greeting: _greetingForNow(),
              businessName: _businessController.text,
              branchName: _activeBranch().name,
              countdownLabel: _countdownLabel(),
              onNotifications: () => _showMessage('Notifications open here'),
              onProfile: () => _changeTab(_HomeTab.account),
            ),
            const SizedBox(height: 12),
            _StoryRail(
              standingSkipped: _standingSkipped,
              onManageStanding: () {
                setState(() {
                  _standingSkipped = !_standingSkipped;
                });
                _showMessage(
                  _standingSkipped
                      ? 'Standing order skipped'
                      : 'Standing order resumed',
                );
              },
            ),
            const SizedBox(height: 14),
            _DayChips(
              selectedIndex: _selectedDateIndex,
              onChanged: _setDateIndex,
              labels: _dateLabels,
            ),
            const SizedBox(height: 12),
            _SectionHeader(
              title: 'Today\'s bakery story',
              subtitle:
                  'Browse the batch that closes tonight for tomorrow morning delivery.',
            ),
            const SizedBox(height: 10),
            _CategoryRow(
              categories: _categories,
              selected: _selectedCategory,
              onChanged: _setCategory,
            ),
            const SizedBox(height: 12),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: filteredProducts.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 0.74,
              ),
              itemBuilder: (context, index) {
                final product = filteredProducts[index];
                final inCart = _cart[product.id] ?? 0;
                return _ProductCard(
                  product: product,
                  inCart: inCart,
                  money: _formatMoney(_priceFor(product.id)),
                  remaining: _remainingFor(product.id),
                  onTap: () => _openProductSheet(product),
                  onAdd: () => _addProduct(product.id),
                  onRemove: () => _removeProduct(product.id),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCartTab() {
    final subtotal = _cartSubtotal();
    final gst = _gstFor(subtotal);
    final delivery = _deliveryFor(subtotal);
    final total = subtotal + gst + delivery;

    return SafeArea(
      bottom: false,
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          18,
          22,
          18,
          124 + MediaQuery.of(context).padding.bottom,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SubHead(
              title: 'Cart & delivery',
              onBack: () => _changeTab(_HomeTab.home),
            ),
            const SizedBox(height: 10),
            _PremiumSectionCard(
              title: 'Your items',
              subtitle: 'Every item is checked against the next day batch.',
              child: _cart.isEmpty
                  ? const _EmptyCard(
                      message:
                          'Your cart is empty - add items from the catalog.',
                    )
                  : Column(
                      children: _cart.entries
                          .map((entry) {
                            final product = _catalog.firstWhere(
                              (item) => item.id == entry.key,
                            );
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _CartItemRow(
                                product: product,
                                quantity: entry.value,
                                money: _formatMoney(
                                  _priceFor(product.id) * entry.value,
                                ),
                                onAdd: () => _addProduct(product.id),
                                onRemove: () => _removeProduct(product.id),
                              ),
                            );
                          })
                          .toList(growable: false),
                    ),
            ),
            const SizedBox(height: 16),
            const _SectionHeader(
              title: 'Delivery date',
              subtitle: 'Pick a date from the next available batches.',
            ),
            const SizedBox(height: 8),
            _DateStrip(
              selectedIndex: _selectedDateIndex,
              labels: _dateLabels,
              onChanged: _setDateIndex,
            ),
            const SizedBox(height: 16),
            const _SectionHeader(
              title: 'Delivery slot',
              subtitle: 'Slots sync with live production capacity.',
            ),
            const SizedBox(height: 8),
            _SlotColumn(
              slots: _slots,
              selectedIndex: _selectedSlotIndex,
              onChanged: _setSlotIndex,
            ),
            const SizedBox(height: 16),
            const _SectionHeader(
              title: 'Payment mode',
              subtitle: 'Choose the payment posture for this order.',
            ),
            const SizedBox(height: 8),
            _PaymentModeCards(
              paymentMode: _paymentMode,
              partPaymentPercent: _partPaymentPercent,
              total: total,
              onModeChanged: _setPaymentMode,
              onPartChanged: _setPartPaymentPercent,
            ),
            const SizedBox(height: 16),
            _PremiumSectionCard(
              title: 'Order summary',
              subtitle: 'The total includes GST and delivery rules.',
              child: Column(
                children: [
                  _ReviewRow(label: 'Subtotal', value: _formatMoney(subtotal)),
                  _ReviewRow(label: 'GST (5%)', value: _formatMoney(gst)),
                  _ReviewRow(
                    label: 'Delivery',
                    value: delivery == 0 ? 'FREE' : _formatMoney(delivery),
                  ),
                  const SizedBox(height: 8),
                  const Divider(height: 1),
                  const SizedBox(height: 8),
                  _ReviewRow(
                    label: 'Total',
                    value: _formatMoney(total),
                    bold: true,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _PremiumSectionCard(
              title: 'Save as standing order',
              subtitle: 'Repeat this cart from the selected branch on chosen days.',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: _standingNotesController,
                    decoration: const InputDecoration(
                      labelText: 'Standing order notes',
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Delivery days',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: AedenPalette.grey,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: const [
                      _StandingDayChip(day: 1, label: 'Mon'),
                      _StandingDayChip(day: 2, label: 'Tue'),
                      _StandingDayChip(day: 3, label: 'Wed'),
                      _StandingDayChip(day: 4, label: 'Thu'),
                      _StandingDayChip(day: 5, label: 'Fri'),
                      _StandingDayChip(day: 6, label: 'Sat'),
                      _StandingDayChip(day: 0, label: 'Sun'),
                    ],
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: _saveStandingOrder,
                    child: const Text('Save standing order'),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Selected branch: ${_activeBranch().name}',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: _cart.isEmpty ? null : _submitOrder,
              child: Text(
                _cart.isEmpty
                    ? 'Add items to continue'
                    : 'Place order · ${_formatMoney(total)}',
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOrdersTab() {
    return SafeArea(
      bottom: false,
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          18,
          22,
          18,
          124 + MediaQuery.of(context).padding.bottom,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SubHead(title: 'Orders', hideBack: true),
            const SizedBox(height: 10),
            const _PremiumSectionCard(
              title: 'Track every batch',
              subtitle:
                  'Confirmations, invoices, and delivery history all live in one place.',
              child: SizedBox.shrink(),
            ),
            const SizedBox(height: 12),
            ..._orders.map((order) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _OrderCard(
                  order: order,
                  money: _formatMoney(order.total),
                  onTap: () =>
                      _showMessage('${order.id} opens tracking details'),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildAccountTab() {
    final activeBranch = _activeBranch();
    return SafeArea(
      bottom: false,
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          18,
          22,
          18,
          124 + MediaQuery.of(context).padding.bottom,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const _SubHead(title: 'Account', hideBack: true),
            const SizedBox(height: 10),
            _PremiumSectionCard(
              title: _businessController.text,
              subtitle: 'Premium wholesale customer profile, branches, and permissions.',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _PremiumBadge(text: _accountTier.toUpperCase()),
                      _PremiumBadge(text: _businessType.toUpperCase()),
                      _PremiumBadge(text: activeBranch.serviceZone.toUpperCase()),
                    ],
                  ),
                  const SizedBox(height: 14),
                  _ReviewRow(label: 'Active branch', value: activeBranch.name),
                  _ReviewRow(label: 'Branch code', value: activeBranch.code),
                  _ReviewRow(label: 'Branch status', value: activeBranch.status.replaceAll('_', ' ')),
                  _ReviewRow(label: 'Branch notes', value: activeBranch.deliveryNotes ?? 'No notes yet'),
                  const SizedBox(height: 6),
                  _ReviewRow(label: 'Contact', value: _contactController.text),
                  _ReviewRow(label: 'Address', value: _addressController.text),
                  _ReviewRow(label: 'GSTIN', value: _gstController.text),
                  _ReviewRow(label: 'Outstanding', value: _formatMoney(9300)),
                  _ReviewRow(
                    label: 'Credit limit',
                    value: _formatMoney(_requestedCreditLimit),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _PremiumSectionCard(
              title: 'Account care',
              subtitle: 'This area stays warm, human, and trust-led.',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SuccessCallout(
                    title: 'FSSAI and GST verified',
                    subtitle:
                        'Ready for contract pricing and invoice checkout.',
                  ),
                  const SizedBox(height: 12),
                  FilledButton(
                    onPressed: () => _showMessage('Support chat opens here'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AedenPalette.ink,
                    ),
                    child: const Text('Contact support'),
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton(
                    onPressed: () => _showMessage('Settings open here'),
                    child: const Text('Manage profile'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _PremiumSectionCard(
              title: 'Branches and users',
              subtitle: 'Choose the branch that should receive the next order, then manage who can act for it.',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Switch branch'),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _branches
                        .map(
                          (branch) => ChoiceChip(
                            selected: branch.id == _selectedBranchId,
                            label: Text(branch.name),
                            onSelected: (_) => _selectBranch(branch.id),
                          ),
                        )
                        .toList(growable: false),
                  ),
                  const SizedBox(height: 14),
                  const Text('Add branch'),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _newBranchNameController,
                    decoration: const InputDecoration(
                      labelText: 'Branch name',
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _newBranchCodeController,
                    decoration: const InputDecoration(
                      labelText: 'Branch code',
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _newBranchNotesController,
                    decoration: const InputDecoration(
                      labelText: 'Delivery notes',
                    ),
                  ),
                  const SizedBox(height: 10),
                  FilledButton(
                    onPressed: _addBranch,
                    child: const Text('Add branch'),
                  ),
                  const SizedBox(height: 14),
                  const Text('Invite user'),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _inviteNameController,
                    decoration: const InputDecoration(
                      labelText: 'Display name',
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _invitePhoneController,
                    decoration: const InputDecoration(
                      labelText: 'Phone',
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _inviteEmailController,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                    ),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: _inviteRole,
                    decoration: const InputDecoration(labelText: 'Role'),
                    items: const [
                      DropdownMenuItem(value: 'admin', child: Text('Admin')),
                      DropdownMenuItem(value: 'buyer', child: Text('Buyer')),
                      DropdownMenuItem(value: 'manager', child: Text('Manager')),
                      DropdownMenuItem(value: 'viewer', child: Text('Viewer')),
                    ],
                    onChanged: (value) {
                      if (value == null) return;
                      setState(() {
                        _inviteRole = value;
                      });
                    },
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: _inviteBranchId,
                    decoration: const InputDecoration(labelText: 'Branch scope'),
                    items: _branches
                        .map(
                          (branch) => DropdownMenuItem(
                            value: branch.id,
                            child: Text(branch.name),
                          ),
                        )
                        .toList(growable: false),
                    onChanged: (value) {
                      setState(() {
                        _inviteBranchId = value;
                      });
                    },
                  ),
                  const SizedBox(height: 10),
                  FilledButton(
                    onPressed: _inviteUser,
                    child: const Text('Send invite'),
                  ),
                  const SizedBox(height: 14),
                  const Text('Current users'),
                  const SizedBox(height: 8),
                  ..._customerUsers.map(
                    (user) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AedenPalette.line),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user.displayName,
                              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${user.role} | ${user.branchId ?? 'account-wide'} | ${user.status}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text('Standing orders'),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _standingChangeReasonController,
                    decoration: const InputDecoration(
                      labelText: 'Change request note',
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (_standingOrders.isEmpty)
                    const _EmptyCard(
                      message: 'No standing orders saved yet.',
                    )
                  else
                    ..._standingOrders.map(
                      (standingOrder) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: AedenPalette.line),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                standingOrder.branchName,
                                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${standingOrder.status} | ${standingOrder.slotLabel} | ${standingOrder.deliveryDays.join(', ')}',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                              if (standingOrder.notes.isNotEmpty) ...[
                                const SizedBox(height: 4),
                                Text(
                                  standingOrder.notes,
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AedenPalette.grey,
                                  ),
                                ),
                              ],
                              const SizedBox(height: 8),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  OutlinedButton(
                                    onPressed: () => _requestStandingOrderChange(standingOrder),
                                    child: Text(
                                      standingOrder.status == 'paused'
                                          ? 'Request resume'
                                          : 'Request pause',
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(height: 12),
                  const Text('Pending change requests'),
                  const SizedBox(height: 8),
                  if (_standingOrderChanges.isEmpty)
                    const _EmptyCard(message: 'No standing order change requests yet.')
                  else
                    ..._standingOrderChanges.map(
                      (change) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: AedenPalette.line),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                change.changeType.replaceAll('_', ' '),
                                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${change.status} | ${change.reason}',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(height: 12),
                  const Text('Recurrence rules'),
                  const SizedBox(height: 8),
                  if (_recurrenceRules.isEmpty)
                    const _EmptyCard(message: 'No recurrence rules configured yet.')
                  else
                    ..._recurrenceRules.map(
                      (rule) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: AedenPalette.line),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                rule.ruleCode,
                                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${rule.status} | ${rule.cadence} | slot ${rule.slotId}',
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(height: 12),
                  const Text('Commercial controls'),
                  const SizedBox(height: 8),
                  if (_pricingRules.isEmpty)
                    const _EmptyCard(message: 'No contract pricing rules are active yet.')
                  else
                    ..._pricingRules.map(
                      (rule) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: AedenPalette.line),
                          ),
                          child: Text(
                            '${rule.productId ?? 'All products'} | Rs. ${rule.price} | ${rule.status}',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(height: 8),
                  Text(
                    _creditHolds.any((hold) => hold.status == 'active')
                        ? 'Credit hold active for this account.'
                        : 'No active credit hold on this account.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: _creditHolds.any((hold) => hold.status == 'active')
                          ? AedenPalette.red
                          : AedenPalette.green,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (_substitutionEvents.isNotEmpty)
                    Text(
                      'Substitution events: ${_substitutionEvents.length}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _greetingForNow() {
    final hour = DateTime.now().hour;
    if (hour < 12) {
      return 'Good morning';
    }
    if (hour < 17) {
      return 'Good afternoon';
    }
    return 'Good evening';
  }
}

class AedenPalette {
  static const cream = Color(0xFFFAF7F2);
  static const ivory = Color(0xFFF5EDE0);
  static const ink = Color(0xFF1C1917);
  static const brown = Color(0xFF92400E);
  static const grey = Color(0xFF57534E);
  static const muted = Color(0xFF85786A);
  static const line = Color(0xFFE9E4DC);
  static const gold = Color(0xFFB45309);
  static const goldBright = Color(0xFFD97706);
  static const goldLight = Color(0xFFC9A35E);
  static const goldMuted = Color(0xFFD9C6A6);
  static const goldSoft = Color(0xFFFEF3E2);
  static const goldLine = Color(0xFFF3DDBE);
  static const green = Color(0xFF15803D);
  static const greenSoft = Color(0xFFECFDF3);
  static const red = Color(0xFFB91C1C);
  static const redSoft = Color(0xFFFEF2F2);
  static const blue = Color(0xFFB45309);
  static const blueSoft = Color(0xFFFBE7D0);
}

class _DarkOrbs extends StatelessWidget {
  const _DarkOrbs();

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(
        children: const [
          Positioned(
            top: 48,
            left: -60,
            child: _GlowOrb(size: 220, color: Color(0x66C9883B)),
          ),
          Positioned(
            top: 280,
            right: -42,
            child: _GlowOrb(size: 160, color: Color(0x66704B22)),
          ),
          Positioned(
            bottom: 34,
            left: -50,
            child: _GlowOrb(size: 190, color: Color(0x66582C12)),
          ),
        ],
      ),
    );
  }
}

class _CreamBackdrop extends StatelessWidget {
  const _CreamBackdrop({this.bright = false});

  final bool bright;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Stack(
        children: [
          Container(color: AedenPalette.cream),
          Positioned(
            top: -80,
            right: -60,
            child: _GlowOrb(
              size: 220,
              color: bright ? const Color(0x23D97706) : const Color(0x18D97706),
            ),
          ),
          Positioned(
            top: 170,
            left: -70,
            child: _GlowOrb(
              size: 180,
              color: bright ? const Color(0x19B45309) : const Color(0x10B45309),
            ),
          ),
        ],
      ),
    );
  }
}

class _GlowOrb extends StatelessWidget {
  const _GlowOrb({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, color: color),
    );
  }
}

class _SealMark extends StatelessWidget {
  const _SealMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 112,
      height: 112,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: AedenPalette.goldLight.withValues(alpha: 0.82),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: AedenPalette.gold.withValues(alpha: 0.16),
            blurRadius: 28,
            offset: const Offset(0, 14),
          ),
        ],
      ),
      child: Center(
        child: Container(
          width: 90,
          height: 90,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: AedenPalette.gold.withValues(alpha: 0.92),
              width: 1.1,
            ),
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 54,
                height: 54,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AedenPalette.gold.withValues(alpha: 0.13),
                ),
              ),
              Text(
                'A',
                style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  color: AedenPalette.goldLight,
                  fontWeight: FontWeight.w600,
                  height: 1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GoldenRule extends StatelessWidget {
  const _GoldenRule({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Expanded(
          child: Container(
            height: 1,
            margin: const EdgeInsets.only(right: 8),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [Colors.transparent, color]),
            ),
          ),
        ),
        Container(
          width: 4,
          height: 4,
          decoration: BoxDecoration(
            color: color,
            shape: BoxShape.rectangle,
            borderRadius: BorderRadius.circular(1),
          ),
        ),
        Expanded(
          child: Container(
            height: 1,
            margin: const EdgeInsets.only(left: 8),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [color, Colors.transparent]),
            ),
          ),
        ),
      ],
    );
  }
}

class _PremiumBadge extends StatelessWidget {
  const _PremiumBadge({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        border: Border.all(
          color: AedenPalette.goldLight.withValues(alpha: 0.28),
        ),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: AedenPalette.goldMuted,
          letterSpacing: 1.2,
          fontSize: 9.5,
        ),
      ),
    );
  }
}

class _CountryChip extends StatelessWidget {
  const _CountryChip();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AedenPalette.line),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        'IN +91',
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
          color: AedenPalette.ink,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _SecureNote extends StatelessWidget {
  const _SecureNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AedenPalette.line),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.lock_outline_rounded, size: 18, color: AedenPalette.gold),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Your number is used only for order updates and account security.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}

class _LabelCapsule extends StatelessWidget {
  const _LabelCapsule({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
            color: AedenPalette.grey,
            letterSpacing: 1.1,
            fontSize: 10.5,
          ),
        ),
        const SizedBox(height: 8),
        child,
      ],
    );
  }
}

class _StepProgress extends StatelessWidget {
  const _StepProgress({required this.currentStep});

  final int currentStep;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(4, (index) {
        final active = index <= currentStep;
        return Expanded(
          child: Container(
            height: 4,
            margin: EdgeInsets.only(right: index == 3 ? 0 : 6),
            decoration: BoxDecoration(
              color: active ? AedenPalette.gold : const Color(0xFFE9E2D7),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
        );
      }),
    );
  }
}

class _OnboardStepCard extends StatelessWidget {
  const _OnboardStepCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      key: key,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w600,
              height: 1.08,
            ),
          ),
          const SizedBox(height: 10),
          Text(subtitle, style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 18),
          child,
        ],
      ),
    );
  }
}

class _SuccessCallout extends StatelessWidget {
  const _SuccessCallout({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AedenPalette.greenSoft,
        border: Border.all(color: const Color(0xFFC9EED6)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          const Icon(Icons.verified_rounded, color: AedenPalette.green, size: 20),







          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: AedenPalette.green,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: AedenPalette.green),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoBanner extends StatelessWidget {
  const _InfoBanner({
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF7E6CC),
        border: Border.all(color: AedenPalette.line),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: AedenPalette.brown,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            subtitle,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AedenPalette.grey,
            ),
          ),
        ],
      ),
    );
  }
}

class _UploadTile extends StatelessWidget {
  const _UploadTile({
    required this.name,
    required this.note,
    required this.uploaded,
    required this.onTap,
  });

  final String name;
  final String note;
  final bool uploaded;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: uploaded ? AedenPalette.greenSoft : Colors.white,
          border: Border.all(
            color: uploaded ? const Color(0xFFC9EED6) : AedenPalette.line,
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: uploaded ? Colors.white : AedenPalette.goldSoft,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  uploaded ? '\u2713' : '\u{1F4C4}',
                  style: const TextStyle(fontSize: 18),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(note, style: Theme.of(context).textTheme.bodySmall),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Text(
              uploaded ? 'Uploaded' : 'Upload',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: uploaded ? AedenPalette.green : AedenPalette.gold,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PaymentChoiceCard extends StatelessWidget {
  const _PaymentChoiceCard({
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
    this.accent = false,
    this.child,
  });

  final String title;
  final String subtitle;
  final bool selected;
  final bool accent;
  final VoidCallback onTap;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: selected
              ? (accent ? AedenPalette.goldSoft : const Color(0xFFF7F1E8))
              : Colors.white,
          border: Border.all(
            color: selected ? AedenPalette.gold : AedenPalette.line,
          ),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 18,
                  height: 18,
                  margin: const EdgeInsets.only(top: 2),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: selected
                          ? AedenPalette.gold
                          : const Color(0xFFD6D3D1),
                      width: 2,
                    ),
                  ),
                  child: selected
                      ? Center(
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: AedenPalette.gold,
                            ),
                          ),
                        )
                      : null,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                if (accent)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AedenPalette.cream,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'Flexible',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: AedenPalette.gold,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
              ],
            ),
            child ?? const SizedBox.shrink(),
          ],
        ),
      ),
    );
  }
}

class _PremiumSectionCard extends StatelessWidget {
  const _PremiumSectionCard({
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AedenPalette.line),
        boxShadow: const [
          BoxShadow(
            color: Color.fromRGBO(96, 58, 18, 0.08),
            blurRadius: 24,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({
    required this.label,
    required this.value,
    this.bold = false,
  });

  final String label;
  final String value;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final valueStyle = Theme.of(context).textTheme.bodyMedium?.copyWith(
      color: AedenPalette.ink,
      fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Text(
              label,
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AedenPalette.grey),
            ),
          ),
          const SizedBox(width: 14),
          Flexible(
            child: Text(value, textAlign: TextAlign.right, style: valueStyle),
          ),
        ],
      ),
    );
  }
}

class _TierCard extends StatelessWidget {
  const _TierCard({
    required this.businessName,
    required this.tier,
    required this.creditLimit,
    required this.creditDays,
  });

  final String businessName;
  final String tier;
  final int creditLimit;
  final int creditDays;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF241E18), Color(0xFF15110D)],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AedenPalette.gold.withValues(alpha: 0.28)),
        boxShadow: const [
          BoxShadow(
            color: Color.fromRGBO(20, 13, 7, 0.34),
            blurRadius: 36,
            offset: Offset(0, 16),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Account · $businessName',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: AedenPalette.goldMuted,
              letterSpacing: 1.4,
              fontSize: 10,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            '$tier · Contract',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: AedenPalette.goldLight,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _MiniMetric(
                  label: 'Credit limit',
                  value: '\u20B9${(creditLimit / 1000).round()}K', 
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MiniMetric(
                  label: 'Credit period',
                  value: '$creditDays days',
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MiniMetric(label: 'Free delivery', value: '₹3,000+'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MiniMetric extends StatelessWidget {
  const _MiniMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: AedenPalette.goldMuted,
              letterSpacing: 1.0,
              fontSize: 9,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: AedenPalette.goldLight,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _PulseRing extends StatelessWidget {
  const _PulseRing();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 90,
      height: 90,
      decoration: BoxDecoration(
        color: AedenPalette.goldSoft,
        shape: BoxShape.circle,
        border: Border.all(color: AedenPalette.goldLine),
      ),
      child: const Center(child: Icon(Icons.schedule_rounded, size: 38, color: AedenPalette.gold)),
    );
  }
}

class _ApprovalMark extends StatelessWidget {
  const _ApprovalMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 90,
      height: 90,
      decoration: BoxDecoration(
        color: AedenPalette.greenSoft,
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFFC9EED6)),
      ),
      child: Center(
      child: Center(
        child: Icon(Icons.check_rounded, color: AedenPalette.green, size: 40),




        ),
      ),
    );
  }
}

class _HomeHeader extends StatelessWidget {
  const _HomeHeader({
    required this.greeting,
    required this.businessName,
    required this.branchName,
    required this.countdownLabel,
    required this.onNotifications,
    required this.onProfile,
  });

  final String greeting;
  final String businessName;
  final String branchName;
  final String countdownLabel;
  final VoidCallback onNotifications;
  final VoidCallback onProfile;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    greeting,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: AedenPalette.grey,
                      fontSize: 11,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    businessName,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    branchName,
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: AedenPalette.brown,
                      fontSize: 10.5,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Row(
              children: [
                _HeaderIconButton(
                  icon: Icons.notifications_none_rounded,
                  badge: '3',
                  onTap: onNotifications,
                ),
                const SizedBox(width: 8),
                _HeaderIconButton(
                  icon: Icons.person_outline_rounded,
                  onTap: onProfile,
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 14),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF262019), Color(0xFF17120D)],
            ),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: AedenPalette.gold.withValues(alpha: 0.22),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Tomorrow\'s bake closes in',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: AedenPalette.goldMuted,
                        fontSize: 10.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Order before 6:00 PM',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: AedenPalette.ivory,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Text(
                countdownLabel,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  color: AedenPalette.goldLight,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({
    required this.icon,
    required this.onTap,
    this.badge,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AedenPalette.line),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Center(child: Icon(icon, size: 20, color: AedenPalette.ink)),
            if (badge != null)
              Positioned(
                top: -3,
                right: -3,
                child: Container(
                  width: 16,
                  height: 16,
                  decoration: BoxDecoration(
                    color: AedenPalette.red,
                    shape: BoxShape.circle,
                    border: Border.all(color: AedenPalette.cream, width: 1.5),
                  ),
                  child: Center(
                    child: Text(
                      badge!,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 8,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _StoryRail extends StatelessWidget {
  const _StoryRail({
    required this.standingSkipped,
    required this.onManageStanding,
  });

  final bool standingSkipped;
  final VoidCallback onManageStanding;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFFFFF7EA), Color(0xFFFDEBD3)],
            ),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AedenPalette.goldLine),
          ),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.8),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Center(
                  child: Text('\u21BB', style: TextStyle(fontSize: 21)), 
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      standingSkipped
                          ? 'Standing order paused'
                          : 'Standing order runs tomorrow',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      standingSkipped
                          ? 'Resume it anytime for tomorrow morning.'
                          : '40 x Multigrain Loaf · 6 - 8 AM · auto-confirms at 6 PM',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AedenPalette.brown,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              OutlinedButton(
                onPressed: onManageStanding,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(82, 36),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                ),
                child: Text(standingSkipped ? 'Resume' : 'Manage'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _DayChips extends StatelessWidget {
  const _DayChips({
    required this.selectedIndex,
    required this.onChanged,
    required this.labels,
  });

  final int selectedIndex;
  final ValueChanged<int> onChanged;
  final List<String> labels;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(labels.length, (index) {
        final selected = index == selectedIndex;
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: index == labels.length - 1 ? 0 : 8),
            child: GestureDetector(
              onTap: () => onChanged(index),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: selected ? AedenPalette.ink : Colors.white,
                  border: Border.all(
                    color: selected ? AedenPalette.ink : AedenPalette.line,
                  ),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  children: [
                    Text(
                      labels[index],
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: selected
                            ? AedenPalette.ivory
                            : AedenPalette.grey,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      switch (index) {
                        0 => 'Today',
                        1 => 'Tomorrow',
                        _ => 'Calendar',
                      },
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: selected
                            ? const Color(0xFFD6CDC2)
                            : AedenPalette.muted,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
            color: AedenPalette.muted,
            letterSpacing: 1.4,
            fontSize: 10.2,
          ),
        ),
        const SizedBox(height: 4),
        Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}

class _CategoryRow extends StatelessWidget {
  const _CategoryRow({
    required this.categories,
    required this.selected,
    required this.onChanged,
  });

  final List<String> categories;
  final String selected;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 38,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: categories.length,
        separatorBuilder: (context, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final category = categories[index];
          final isSelected = category == selected;
          return GestureDetector(
            onTap: () => onChanged(category),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: isSelected ? AedenPalette.ink : Colors.white,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: isSelected ? AedenPalette.ink : AedenPalette.line,
                ),
              ),
              child: Center(
                child: Text(
                  category,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: isSelected ? AedenPalette.ivory : AedenPalette.grey,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ProductHero extends StatelessWidget {
  const _ProductHero({required this.product, required this.compact});

  final _Product product;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final height = compact ? 104.0 : 124.0;
    return Container(
      height: height,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [product.accentA, product.accentB],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Stack(
        children: [
          Positioned(
            top: 8,
            left: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                product.remaining <= 0
                    ? 'Sold out'
                    : product.remaining <= 10
                    ? 'Low stock'
                    : '${product.remaining} left',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: product.remaining <= 0
                      ? AedenPalette.grey
                      : AedenPalette.gold,
                  fontWeight: FontWeight.w800,
                  fontSize: 9.5,
                ),
              ),
            ),
          ),
          Center(
            child: Text(product.emoji, style: const TextStyle(fontSize: 46)),
          ),
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(20),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.white.withValues(alpha: 0.45),
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.05),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({
    required this.product,
    required this.inCart,
    required this.money,
    required this.remaining,
    required this.onTap,
    required this.onAdd,
    required this.onRemove,
  });

  final _Product product;
  final int inCart;
  final String money;
  final int remaining;
  final VoidCallback onTap;
  final VoidCallback onAdd;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final soldOut = remaining <= 0;
    final lowStock = remaining > 0 && remaining <= 10;
    return GestureDetector(
      onTap: soldOut ? null : onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AedenPalette.line),
          boxShadow: const [
            BoxShadow(
              color: Color.fromRGBO(96, 64, 28, 0.06),
              blurRadius: 14,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _ProductHero(product: product, compact: true),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    product.name,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    product.pack,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: AedenPalette.goldSoft,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'Order by ${product.cutoff}',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: AedenPalette.brown,
                        fontSize: 9.2,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        money,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      _AddControl(
                        inCart: inCart,
                        remaining: remaining,
                        onAdd: onAdd,
                        onRemove: onRemove,
                      ),
                    ],
                  ),
                  if (soldOut || lowStock) ...[
                    const SizedBox(height: 8),
                    Text(
                      soldOut
                          ? 'Sold out tomorrow'
                          : '$remaining left for tomorrow',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: soldOut ? AedenPalette.grey : AedenPalette.red,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AddControl extends StatelessWidget {
  const _AddControl({
    required this.inCart,
    required this.remaining,
    required this.onAdd,
    required this.onRemove,
  });

  final int inCart;
  final int remaining;
  final VoidCallback onAdd;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    if (remaining <= 0) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: const Color(0xFFF5F5F4),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          'Sold out',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: AedenPalette.grey,
            fontWeight: FontWeight.w800,
          ),
        ),
      );
    }

    if (inCart <= 0) {
      return OutlinedButton(
        onPressed: onAdd,
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(0, 34),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          side: const BorderSide(color: AedenPalette.gold),
          foregroundColor: AedenPalette.gold,
        ),
        child: const Text('ADD'),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: AedenPalette.gold,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _StepperButton(icon: Icons.remove, onTap: onRemove),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(
              '$inCart',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          _StepperButton(icon: Icons.add, onTap: onAdd),
        ],
      ),
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
        width: 24,
        height: 28,
        child: Icon(icon, size: 15, color: Colors.white),
      ),
    );
  }
}

class _ContractRow extends StatelessWidget {
  const _ContractRow({
    required this.label,
    required this.value,
    required this.tone,
  });

  final String label;
  final String value;
  final _ContractTone tone;

  @override
  Widget build(BuildContext context) {
    final color = switch (tone) {
      _ContractTone.gold => AedenPalette.brown,
      _ContractTone.blue => AedenPalette.blue,
    };
    final background = switch (tone) {
      _ContractTone.gold => AedenPalette.goldSoft,
      _ContractTone.blue => AedenPalette.blueSoft,
    };
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: switch (tone) {
            _ContractTone.gold => AedenPalette.goldLine,
            _ContractTone.blue => const Color(0xFFC7DBFE),
          },
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: color,
              letterSpacing: 1.2,
              fontSize: 9.5,
            ),
          ),
          Text(
            value,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

enum _ContractTone { gold, blue }

class _CartItemRow extends StatelessWidget {
  const _CartItemRow({
    required this.product,
    required this.quantity,
    required this.money,
    required this.onAdd,
    required this.onRemove,
  });

  final _Product product;
  final int quantity;
  final String money;
  final VoidCallback onAdd;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AedenPalette.line),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              gradient: LinearGradient(
                colors: [product.accentA, product.accentB],
              ),
            ),
            child: Center(
              child: Text(product.emoji, style: const TextStyle(fontSize: 24)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  product.name,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 2),
                Text(
                  '${product.pack} · ${_formatPackPrice(product.price)}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          _CartStepper(quantity: quantity, onAdd: onAdd, onRemove: onRemove),
          const SizedBox(width: 10),
          Text(
            money,
            style: Theme.of(
              context,
            ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
        ],
      ),
    );
  }

  String _formatPackPrice(int value) => '\u20B9$value';
}

class _CartStepper extends StatelessWidget {
  const _CartStepper({
    required this.quantity,
    required this.onAdd,
    required this.onRemove,
  });

  final int quantity;
  final VoidCallback onAdd;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AedenPalette.gold,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _StepperButton(icon: Icons.remove, onTap: onRemove),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Text(
              '$quantity',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          _StepperButton(icon: Icons.add, onTap: onAdd),
        ],
      ),
    );
  }
}

class _DateStrip extends StatelessWidget {
  const _DateStrip({
    required this.selectedIndex,
    required this.labels,
    required this.onChanged,
  });

  final int selectedIndex;
  final List<String> labels;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final chips = <Widget>[];
    for (var index = 0; index < labels.length; index++) {
      final selected = index == selectedIndex;
      chips.add(
        GestureDetector(
          onTap: () => onChanged(index),
          child: Container(
            width: 72,
            margin: EdgeInsets.only(right: index == labels.length - 1 ? 0 : 8),
            padding: const EdgeInsets.symmetric(vertical: 10),
            decoration: BoxDecoration(
              color: selected ? AedenPalette.ink : Colors.white,
              border: Border.all(
                color: selected ? AedenPalette.ink : AedenPalette.line,
              ),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(
              children: [
                Text(
                  labels[index],
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: selected ? AedenPalette.ivory : AedenPalette.grey,
                    fontSize: 11.5,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  switch (index) {
                    0 => 'Now',
                    1 => 'Next',
                    _ => 'Later',
                  },
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: selected
                        ? const Color(0xFFD6CDC2)
                        : AedenPalette.muted,
                    fontSize: 9,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return SizedBox(
      height: 56,
      child: ListView(scrollDirection: Axis.horizontal, children: chips),
    );
  }
}

class _SlotColumn extends StatelessWidget {
  const _SlotColumn({
    required this.slots,
    required this.selectedIndex,
    required this.onChanged,
  });

  final List<_DeliverySlot> slots;
  final int selectedIndex;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(slots.length, (index) {
        final slot = slots[index];
        final selected = index == selectedIndex;
        return Padding(
          padding: EdgeInsets.only(bottom: index == slots.length - 1 ? 0 : 8),
          child: GestureDetector(
            onTap: slot.available ? () => onChanged(index) : null,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: selected ? AedenPalette.goldSoft : Colors.white,
                border: Border.all(
                  color: selected ? AedenPalette.gold : AedenPalette.line,
                ),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    slot.label,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: slot.available
                          ? AedenPalette.greenSoft
                          : const Color(0xFFF5F5F4),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      slot.note,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: slot.available
                            ? AedenPalette.green
                            : AedenPalette.grey,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }),
    );
  }
}

class _PaymentModeCards extends StatelessWidget {
  const _PaymentModeCards({
    required this.paymentMode,
    required this.partPaymentPercent,
    required this.total,
    required this.onModeChanged,
    required this.onPartChanged,
  });

  final String paymentMode;
  final int partPaymentPercent;
  final int total;
  final ValueChanged<String> onModeChanged;
  final ValueChanged<int> onPartChanged;

  @override
  Widget build(BuildContext context) {
    final partAmount = (total * partPaymentPercent / 100).round();
    final balanceAmount = total - partAmount;
    return Column(
      children: [
        _PaymentRowCard(
          title: 'Pay now',
          subtitle: 'Full amount via UPI, card, or net banking.',
          tag: 'Recommended',
          selected: paymentMode == 'prepaid',
          tagBackground: AedenPalette.greenSoft,
          tagForeground: AedenPalette.green,
          onTap: () => onModeChanged('prepaid'),
        ),
        const SizedBox(height: 10),
        _PaymentRowCard(
          title: 'Part payment',
          subtitle: 'Advance now, balance on delivery.',
          tag: 'Flexible',
          selected: paymentMode == 'part',
          tagBackground: AedenPalette.goldSoft,
          tagForeground: AedenPalette.gold,
          onTap: () => onModeChanged('part'),
          child: Padding(
            padding: const EdgeInsets.only(left: 28, top: 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  children: [30, 50]
                      .map((percent) {
                        final selected = percent == partPaymentPercent;
                        return ChoiceChip(
                          selected: selected,
                          label: Text('$percent% now'),
                          onSelected: (_) {
                            onModeChanged('part');
                            onPartChanged(percent);
                          },
                        );
                      })
                      .toList(growable: false),
                ),
                const SizedBox(height: 8),
                Text(
                  'Pay ${partAmount == 0 ? "\u20B90" : "\u20B9$partAmount"} now \u00B7 ${balanceAmount == 0 ? "\u20B90" : "\u20B9$balanceAmount"} on delivery',
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: AedenPalette.grey),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 10),
        _PaymentRowCard(
          title: 'Buy on credit',
          subtitle: 'Invoice now, pay within your approved period.',
          tag: '15-day terms',
          selected: paymentMode == 'credit',
          tagBackground: AedenPalette.blueSoft,
          tagForeground: AedenPalette.blue,
          onTap: () => onModeChanged('credit'),
          child: Padding(
            padding: const EdgeInsets.only(left: 28, top: 10),
            child: Text(
              'This mirrors Aeden\'s approved customer credit flow.',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AedenPalette.grey),
            ),
          ),
        ),
      ],
    );
  }
}

class _PaymentRowCard extends StatelessWidget {
  const _PaymentRowCard({
    required this.title,
    required this.subtitle,
    required this.tag,
    required this.selected,
    required this.tagBackground,
    required this.tagForeground,
    required this.onTap,
    this.child,
  });

  final String title;
  final String subtitle;
  final String tag;
  final bool selected;
  final Color tagBackground;
  final Color tagForeground;
  final VoidCallback onTap;
  final Widget? child;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFFFFFBF2) : Colors.white,
          border: Border.all(
            color: selected ? AedenPalette.gold : AedenPalette.line,
          ),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 18,
                  height: 18,
                  margin: const EdgeInsets.only(top: 2),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: selected
                          ? AedenPalette.gold
                          : const Color(0xFFD6D3D1),
                      width: 2,
                    ),
                  ),
                  child: selected
                      ? Center(
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: AedenPalette.gold,
                            ),
                          ),
                        )
                      : null,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: tagBackground,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    tag,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: tagForeground,
                      fontWeight: FontWeight.w800,
                      fontSize: 9.2,
                    ),
                  ),
                ),
              ],
            ),
            child ?? const SizedBox.shrink(),
          ],
        ),
      ),
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({
    required this.order,
    required this.money,
    required this.onTap,
  });

  final _Order order;
  final String money;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: AedenPalette.line),
          boxShadow: const [
            BoxShadow(
              color: Color.fromRGBO(96, 58, 18, 0.06),
              blurRadius: 12,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  order.id,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                _StatusChip(label: order.statusLabel),
              ],
            ),
            const SizedBox(height: 5),
            Text(order.createdAt, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 3),
            Text(
              order.branchName,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: AedenPalette.brown,
                fontSize: 10.5,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              order.items.join(' · '),
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(color: AedenPalette.ink),
            ),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  order.paymentModeLabel,
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(color: AedenPalette.grey),
                ),
                Text(
                  money,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = switch (label) {
      'Delivered' => (AedenPalette.greenSoft, AedenPalette.green),
      'In production' => (AedenPalette.goldSoft, AedenPalette.gold),
      _ => (AedenPalette.blueSoft, AedenPalette.blue),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: colors.$1,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: colors.$2,
          fontWeight: FontWeight.w800,
          fontSize: 9.4,
        ),
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AedenPalette.goldSoft,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AedenPalette.goldLine),
      ),
      child: Text(
        message,
        style: Theme.of(
          context,
        ).textTheme.bodyMedium?.copyWith(color: AedenPalette.brown),
      ),
    );
  }
}

class _SubHead extends StatelessWidget {
  const _SubHead({required this.title, this.onBack, this.hideBack = false});

  final String title;
  final VoidCallback? onBack;
  final bool hideBack;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        if (!hideBack)
          GestureDetector(
            onTap: onBack,
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AedenPalette.line),
              ),
              child: const Center(
                child: Icon(
                  Icons.arrow_back_rounded,
                  size: 18,
                  color: AedenPalette.ink,
                ),
              ),
            ),
          ),
        if (!hideBack) const SizedBox(width: 12),
        Text(
          title,
          style: Theme.of(
            context,
          ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
        ),
      ],
    );
  }
}

class _BottomNav extends StatelessWidget {
  const _BottomNav({required this.tab, required this.onChanged});

  final _HomeTab tab;
  final ValueChanged<_HomeTab> onChanged;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(6, 8, 6, 18 + bottomInset),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        border: const Border(top: BorderSide(color: AedenPalette.line)),
      ),
      child: Row(
        children: [
          _NavItem(
            icon: Icons.home_rounded,
            label: 'Home',
            selected: tab == _HomeTab.home,
            onTap: () => onChanged(_HomeTab.home),
          ),
          _NavItem(
            icon: Icons.shopping_bag_rounded,
            label: 'Cart',
            selected: tab == _HomeTab.cart,
            onTap: () => onChanged(_HomeTab.cart),
          ),
          _NavItem(
            icon: Icons.receipt_long_rounded,
            label: 'Orders',
            selected: tab == _HomeTab.orders,
            onTap: () => onChanged(_HomeTab.orders),
          ),
          _NavItem(
            icon: Icons.person_rounded,
            label: 'Account',
            selected: tab == _HomeTab.account,
            onTap: () => onChanged(_HomeTab.account),
          ),
        ],
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AedenPalette.gold : const Color(0xFFA8A29E);
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 4),
          color: Colors.transparent,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 21, color: color),
              const SizedBox(height: 3),
              Text(
                label,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w700,
                  fontSize: 9.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GrabHandle extends StatelessWidget {
  const _GrabHandle();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 44,
        height: 4,
        decoration: BoxDecoration(
          color: const Color(0xFFE7E0D7),
          borderRadius: BorderRadius.circular(99),
        ),
      ),
    );
  }
}

class _Product {
  const _Product({
    required this.id,
    required this.name,
    required this.pack,
    required this.category,
    required this.price,
    required this.remaining,
    required this.cutoff,
    required this.emoji,
    required this.note,
    required this.accentA,
    required this.accentB,
  });

  final String id;
  final String name;
  final String pack;
  final String category;
  final int price;
  final int remaining;
  final String cutoff;
  final String emoji;
  final String note;
  final Color accentA;
  final Color accentB;
}

class _DeliverySlot {
  const _DeliverySlot({
    required this.id,
    required this.label,
    required this.note,
    required this.available,
  });

  final String id;
  final String label;
  final String note;
  final bool available;
}

class _Order {
  const _Order({
    required this.id,
    required this.createdAt,
    required this.branchName,
    required this.statusLabel,
    required this.paymentModeLabel,
    required this.total,
    required this.stage,
    required this.items,
  });

  final String id;
  final String createdAt;
  final String branchName;
  final String statusLabel;
  final String paymentModeLabel;
  final int total;
  final int stage;
  final List<String> items;
}

class _CustomerBranch {
  const _CustomerBranch({
    required this.id,
    required this.name,
    required this.code,
    required this.serviceZone,
    required this.status,
    this.deliveryNotes,
  });

  final String id;
  final String name;
  final String code;
  final String serviceZone;
  final String status;
  final String? deliveryNotes;
}

class _CustomerUser {
  const _CustomerUser({
    required this.id,
    required this.displayName,
    required this.role,
    required this.status,
    required this.branchId,
    this.phone,
    this.email,
  });

  final String id;
  final String displayName;
  final String role;
  final String status;
  final String? branchId;
  final String? phone;
  final String? email;
}

class _StandingOrder {
  const _StandingOrder({
    required this.id,
    required this.branchName,
    required this.status,
    required this.slotLabel,
    required this.deliveryDays,
    required this.notes,
  });

  final String id;
  final String branchName;
  final String status;
  final String slotLabel;
  final List<int> deliveryDays;
  final String notes;
}

class _StandingOrderChange {
  const _StandingOrderChange({
    required this.id,
    required this.standingOrderId,
    required this.status,
    required this.changeType,
    required this.branchId,
    required this.reason,
    required this.requestedBy,
    required this.requestedAt,
    required this.decidedBy,
    required this.decidedAt,
  });

  final String id;
  final String standingOrderId;
  final String status;
  final String changeType;
  final String? branchId;
  final String reason;
  final String requestedBy;
  final String requestedAt;
  final String? decidedBy;
  final String? decidedAt;
}

class _RecurrenceRule {
  const _RecurrenceRule({
    required this.id,
    required this.ruleCode,
    required this.status,
    required this.cadence,
    required this.branchId,
    required this.customerId,
    required this.slotId,
    required this.branchScoped,
    required this.deliveryDays,
    required this.notes,
  });

  final String id;
  final String ruleCode;
  final String status;
  final String cadence;
  final String? branchId;
  final String? customerId;
  final String slotId;
  final bool branchScoped;
  final List<int> deliveryDays;
  final String? notes;
}

class _CustomerPricingRule {
  const _CustomerPricingRule({
    required this.id,
    required this.customerId,
    required this.branchId,
    required this.productId,
    required this.price,
    required this.pricingMode,
    required this.status,
    required this.reason,
  });

  final String id;
  final String? customerId;
  final String? branchId;
  final String? productId;
  final int price;
  final String pricingMode;
  final String status;
  final String? reason;
}

class _CreditHoldEvent {
  const _CreditHoldEvent({
    required this.id,
    required this.customerId,
    required this.branchId,
    required this.status,
    required this.reason,
    required this.createdAt,
    required this.releasedAt,
  });

  final String id;
  final String customerId;
  final String? branchId;
  final String status;
  final String reason;
  final String createdAt;
  final String? releasedAt;
}

class _CreditLedgerEntry {
  const _CreditLedgerEntry({
    required this.id,
    required this.customerId,
    required this.branchId,
    required this.entryType,
    required this.amount,
    required this.balanceAfter,
    required this.referenceType,
    required this.referenceId,
    required this.note,
    required this.createdAt,
  });

  final String id;
  final String customerId;
  final String? branchId;
  final String entryType;
  final int amount;
  final int balanceAfter;
  final String referenceType;
  final String referenceId;
  final String? note;
  final String createdAt;
}

class _SubstitutionRule {
  const _SubstitutionRule({
    required this.id,
    required this.customerId,
    required this.branchId,
    required this.productId,
    required this.substituteProductId,
    required this.status,
    required this.reason,
  });

  final String id;
  final String? customerId;
  final String? branchId;
  final String productId;
  final String substituteProductId;
  final String status;
  final String reason;
}

class _SubstitutionEvent {
  const _SubstitutionEvent({
    required this.id,
    required this.customerId,
    required this.branchId,
    required this.orderId,
    required this.productId,
    required this.substituteProductId,
    required this.status,
    required this.reason,
    required this.createdAt,
  });

  final String id;
  final String customerId;
  final String? branchId;
  final String? orderId;
  final String productId;
  final String substituteProductId;
  final String status;
  final String reason;
  final String createdAt;
}

class _StandingDayChip extends StatefulWidget {
  const _StandingDayChip({
    required this.day,
    required this.label,
  });

  final int day;
  final String label;

  @override
  State<_StandingDayChip> createState() => _StandingDayChipState();
}

class _StandingDayChipState extends State<_StandingDayChip> {
  @override
  Widget build(BuildContext context) {
    final selected = context.findAncestorStateOfType<_AedenJourneyState>()?._standingDays.contains(widget.day) ?? false;
    return FilterChip(
      selected: selected,
      label: Text(widget.label),
      onSelected: (_) {
        context.findAncestorStateOfType<_AedenJourneyState>()?._toggleStandingDay(widget.day);
      },
    );
  }
}
