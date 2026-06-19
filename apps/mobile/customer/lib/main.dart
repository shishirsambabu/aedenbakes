import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  runApp(const BakeryCustomerApp());
}

const String _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://127.0.0.1:4000',
);
const String _tokenKey = 'aeden_customer_token_v1';

class BakeryCustomerApp extends StatelessWidget {
  const BakeryCustomerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Aeden Bakes Customer',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFD97B41),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF8F1E8),
      ),
      home: const CustomerHome(),
    );
  }
}

class CustomerHome extends StatefulWidget {
  const CustomerHome({super.key});

  @override
  State<CustomerHome> createState() => _CustomerHomeState();
}

class _CustomerHomeState extends State<CustomerHome> {
  final _loginFormKey = GlobalKey<FormState>();
  final _onboardFormKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _zoneController = TextEditingController();
  final _loginIdController = TextEditingController();
  final _passwordController = TextEditingController();
  final _addressController = TextEditingController();

  bool _booting = true;
  bool _loading = false;
  bool _signingOut = false;
  String? _error;
  String? _notice;
  String? _token;
  _AuthMode _mode = _AuthMode.signIn;
  _CustomerDashboard? _dashboard;
  Map<String, int> _cart = {};
  String _paymentMode = 'prepaid';
  String? _selectedSlotId;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _zoneController.dispose();
    _loginIdController.dispose();
    _passwordController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedToken = prefs.getString(_tokenKey);
      if (savedToken != null && savedToken.isNotEmpty) {
        _token = savedToken;
        await _loadDashboard();
      }
    } catch (error) {
      _error = error.toString();
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _booting = false;
      });
    }
  }

  Future<void> _loadDashboard() async {
    final token = _token;
    if (token == null) {
      throw Exception('Missing customer session token');
    }

    final response = await http.get(
      Uri.parse('$_apiBaseUrl/customer/dashboard'),
      headers: _authHeaders(token),
    );

    if (response.statusCode == 401) {
      await _clearSession();
      throw Exception('Your session expired. Please sign in again.');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final payload = _readJson(response.body);
      throw Exception(payload?['error'] as String? ?? 'Could not load your dashboard');
    }

    final dashboardJson = _readJson(response.body);
    if (dashboardJson == null) {
      throw Exception('Dashboard payload was invalid.');
    }

    if (!mounted) {
      return;
    }

    setState(() {
      _dashboard = _CustomerDashboard.fromJson(dashboardJson);
      _error = null;
      _notice = null;
      _selectedSlotId ??= _dashboard!.serviceability.availableSlots.isNotEmpty
          ? _dashboard!.serviceability.availableSlots.first.slotId
          : (_dashboard!.serviceability.slots.isNotEmpty ? _dashboard!.serviceability.slots.first.slotId : null);
      _paymentMode = 'prepaid';
    });
  }

  Future<void> _refresh() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await _loadDashboard();
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _signIn() async {
    if (!_loginFormKey.currentState!.validate()) {
      return;
    }

    await _submitAuth(
      endpoint: '/auth/login',
      body: {
        'username': _loginIdController.text.trim(),
        'password': _passwordController.text.trim(),
      },
      successLabel: 'Signed in',
    );
  }

  Future<void> _onboard() async {
    if (!_onboardFormKey.currentState!.validate()) {
      return;
    }

    await _submitAuth(
      endpoint: '/customer/onboard',
      body: {
        'name': _nameController.text.trim(),
        'deliveryZone': _zoneController.text.trim(),
        'loginId': _loginIdController.text.trim(),
        'password': _passwordController.text.trim(),
        'defaultAddress': _addressController.text.trim(),
      },
      successLabel: 'Customer profile created',
    );
  }

  Future<void> _submitAuth({
    required String endpoint,
    required Map<String, dynamic> body,
    required String successLabel,
  }) async {
    setState(() {
      _loading = true;
      _error = null;
      _notice = null;
    });

    try {
      final response = await http.post(
        Uri.parse('$_apiBaseUrl$endpoint'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );

      final payload = _readJson(response.body);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception(payload?['error'] as String? ?? 'Could not complete request');
      }

      final token = payload?['token'] as String?;
      final user = payload?['user'] as Map<String, dynamic>?;
      if (token == null || user == null) {
        throw Exception('Server response was missing session data.');
      }
      if ((user['role'] as String?) != 'customer') {
        throw Exception('This app only supports customer accounts.');
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_tokenKey, token);
      _token = token;

      if (endpoint == '/customer/onboard') {
        final dashboardJson = payload?['dashboard'] as Map<String, dynamic>?;
        if (dashboardJson != null) {
          if (!mounted) {
            return;
          }
          setState(() {
            _dashboard = _CustomerDashboard.fromJson(dashboardJson);
            _selectedSlotId = _dashboard!.serviceability.availableSlots.isNotEmpty
                ? _dashboard!.serviceability.availableSlots.first.slotId
                : (_dashboard!.serviceability.slots.isNotEmpty ? _dashboard!.serviceability.slots.first.slotId : null);
          });
        } else {
          await _loadDashboard();
        }
      } else {
        await _loadDashboard();
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _notice = successLabel;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _placeOrder() async {
    final dashboard = _dashboard;
    final token = _token;
    if (dashboard == null || token == null) {
      return;
    }

    final items = _cart.entries.where((entry) => entry.value > 0).toList(growable: false);
    if (items.isEmpty) {
      setState(() {
        _error = 'Add at least one item before placing an order.';
      });
      return;
    }

    final slotId = _selectedSlotId ?? dashboard.serviceability.availableSlots.firstOrNull?.slotId;
    if (slotId == null) {
      setState(() {
        _error = 'No delivery slot is available for your zone.';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
      _notice = null;
    });

    try {
      final response = await http.post(
        Uri.parse('$_apiBaseUrl/customer/orders'),
        headers: {
          ..._authHeaders(token),
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'serviceDate': dashboard.defaultServiceDate,
          'slotId': slotId,
          'paymentMode': _paymentMode,
          'items': items
              .map(
                (entry) => {
                  'productId': entry.key,
                  'quantity': entry.value,
                },
              )
              .toList(),
        }),
      );

      final payload = _readJson(response.body);
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception(payload?['error'] as String? ?? 'Order submission failed');
      }

      final dashboardJson = payload?['dashboard'] as Map<String, dynamic>?;
      if (dashboardJson == null) {
        throw Exception('Order response did not include a dashboard snapshot.');
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _dashboard = _CustomerDashboard.fromJson(dashboardJson);
        _cart = {};
        _selectedSlotId = _dashboard!.serviceability.availableSlots.isNotEmpty
            ? _dashboard!.serviceability.availableSlots.first.slotId
            : (_dashboard!.serviceability.slots.isNotEmpty ? _dashboard!.serviceability.slots.first.slotId : null);
        _notice = 'Order placed successfully.';
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _loading = false;
      });
    }
  }

  Future<void> _signOut() async {
    final token = _token;
    setState(() {
      _signingOut = true;
    });

    try {
      if (token != null) {
        await http.post(
          Uri.parse('$_apiBaseUrl/auth/logout'),
          headers: _authHeaders(token),
        );
      }
    } catch (_) {
      // Signing out should still clear the local session.
    }

    await _clearSession();

    if (!mounted) {
      return;
    }
    setState(() {
      _signingOut = false;
    });
  }

  Future<void> _clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    if (!mounted) {
      return;
    }
    setState(() {
      _token = null;
      _dashboard = null;
      _cart = {};
      _selectedSlotId = null;
    });
  }

  void _changeQuantity(String productId, int delta) {
    setState(() {
      final next = (_cart[productId] ?? 0) + delta;
      if (next <= 0) {
        _cart.remove(productId);
      } else {
        _cart[productId] = next;
      }
    });
  }

  Map<String, String> _authHeaders(String token) => {'Authorization': 'Bearer $token'};

  Map<String, dynamic>? _readJson(String body) {
    final decoded = jsonDecode(body);
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    if (_booting) {
      return const _LoadingScreen(message: 'Opening customer workspace...');
    }

    if (_dashboard == null) {
      return _AuthScreen(
        mode: _mode,
        loading: _loading,
        error: _error,
        onModeChanged: (mode) {
          setState(() {
            _mode = mode;
            _error = null;
            _notice = null;
          });
        },
        loginFormKey: _loginFormKey,
        onboardFormKey: _onboardFormKey,
        nameController: _nameController,
        zoneController: _zoneController,
        loginIdController: _loginIdController,
        passwordController: _passwordController,
        addressController: _addressController,
        onSignIn: _signIn,
        onOnboard: _onboard,
      );
    }

    final dashboard = _dashboard!;
    final cartCount = _cart.values.fold<int>(0, (sum, value) => sum + value);
    final cartTotal = _cart.entries.fold<double>(0, (sum, entry) {
      final product = dashboard.productById[entry.key];
      return sum + ((product?.unitPrice ?? 0) * entry.value);
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('Customer workspace'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: Text(
                dashboard.customer.name,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: FilledButton.tonal(
              onPressed: _signingOut ? null : _signOut,
              child: Text(_signingOut ? 'Signing out...' : 'Sign out'),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _HeroCard(
              title: 'Order against live bakery capacity.',
              subtitle: 'Customers see the same serviceability that production and delivery use.',
              statusLabel: dashboard.serviceability.canOrder ? 'Can order' : 'Blocked',
              statusValue: dashboard.serviceability.canOrder ? 'Yes' : 'No',
              detailLabel: 'Default service date',
              detailValue: dashboard.defaultServiceDate,
            ),
            if (_notice != null) ...[
              const SizedBox(height: 12),
              _Banner(text: _notice!, tone: _BannerTone.good),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              _Banner(text: _error!, tone: _BannerTone.bad),
            ],
            const SizedBox(height: 16),
            _AccountCard(customer: dashboard.customer, auth: dashboard.auth),
            const SizedBox(height: 16),
            _ServiceabilityCard(
              serviceability: dashboard.serviceability,
              selectedSlotId: _selectedSlotId,
              onSlotSelected: (slotId) {
                setState(() {
                  _selectedSlotId = slotId;
                });
              },
            ),
            const SizedBox(height: 16),
            _CatalogCard(
              dashboard: dashboard,
              cart: _cart,
              onAdd: (productId) => _changeQuantity(productId, 1),
              onRemove: (productId) => _changeQuantity(productId, -1),
            ),
            const SizedBox(height: 16),
            _CheckoutCard(
              paymentMode: _paymentMode,
              cartCount: cartCount,
              cartTotal: cartTotal,
              canSubmit: dashboard.serviceability.canOrder && cartCount > 0 && !_loading,
              serviceabilityReasons: dashboard.serviceability.reasons,
              onPaymentModeChanged: (mode) {
                setState(() {
                  _paymentMode = mode;
                });
              },
              onSubmit: _placeOrder,
            ),
            const SizedBox(height: 16),
            _OrdersCard(orders: dashboard.orders),
          ],
        ),
      ),
    );
  }
}

enum _AuthMode { signIn, onboard }

class _AuthScreen extends StatelessWidget {
  const _AuthScreen({
    required this.mode,
    required this.loading,
    required this.error,
    required this.onModeChanged,
    required this.loginFormKey,
    required this.onboardFormKey,
    required this.nameController,
    required this.zoneController,
    required this.loginIdController,
    required this.passwordController,
    required this.addressController,
    required this.onSignIn,
    required this.onOnboard,
  });

  final _AuthMode mode;
  final bool loading;
  final String? error;
  final ValueChanged<_AuthMode> onModeChanged;
  final GlobalKey<FormState> loginFormKey;
  final GlobalKey<FormState> onboardFormKey;
  final TextEditingController nameController;
  final TextEditingController zoneController;
  final TextEditingController loginIdController;
  final TextEditingController passwordController;
  final TextEditingController addressController;
  final Future<void> Function() onSignIn;
  final Future<void> Function() onOnboard;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.92),
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: const [
                    BoxShadow(
                      color: Color.fromRGBO(96, 58, 18, 0.12),
                      blurRadius: 32,
                      offset: Offset(0, 18),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Aeden Bakes customer',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                            color: const Color(0xFFB45B28),
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.6,
                          ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      mode == _AuthMode.signIn ? 'Sign in' : 'Create customer profile',
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w900),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      mode == _AuthMode.signIn
                          ? 'Use your customer login to see live capacity, place orders, and review history.'
                          : 'Create a new wholesale customer account against the bakery system.',
                    ),
                    const SizedBox(height: 18),
                    SegmentedButton<_AuthMode>(
                      segments: const [
                        ButtonSegment(value: _AuthMode.signIn, label: Text('Sign in')),
                        ButtonSegment(value: _AuthMode.onboard, label: Text('Onboard')),
                      ],
                      selected: {mode},
                      onSelectionChanged: (values) => onModeChanged(values.first),
                    ),
                    const SizedBox(height: 18),
                    if (mode == _AuthMode.signIn)
                      Form(
                        key: loginFormKey,
                        child: Column(
                          children: [
                            _Field(
                              label: 'Login ID',
                              hint: '9000000001',
                              controller: loginIdController,
                              validator: (value) => value == null || value.trim().isEmpty ? 'Login ID is required' : null,
                            ),
                            const SizedBox(height: 14),
                            _Field(
                              label: 'Password',
                              hint: '••••••••',
                              controller: passwordController,
                              obscureText: true,
                              validator: (value) => value == null || value.trim().isEmpty ? 'Password is required' : null,
                            ),
                            const SizedBox(height: 16),
                            if (error != null) _Banner(text: error!, tone: _BannerTone.bad),
                            const SizedBox(height: 16),
                            FilledButton(
                              onPressed: loading ? null : () => onSignIn(),
                              child: SizedBox(
                                width: double.infinity,
                                child: Center(child: Text(loading ? 'Signing in...' : 'Sign in')),
                              ),
                            ),
                          ],
                        ),
                      )
                    else
                      Form(
                        key: onboardFormKey,
                        child: Column(
                          children: [
                            _Field(
                              label: 'Business name',
                              hint: 'Cafe Nook',
                              controller: nameController,
                              validator: (value) => value == null || value.trim().isEmpty ? 'Business name is required' : null,
                            ),
                            const SizedBox(height: 14),
                            _Field(
                              label: 'Delivery zone',
                              hint: 'North',
                              controller: zoneController,
                              validator: (value) => value == null || value.trim().isEmpty ? 'Delivery zone is required' : null,
                            ),
                            const SizedBox(height: 14),
                            _Field(
                              label: 'Login ID',
                              hint: '9000000003',
                              controller: loginIdController,
                              validator: (value) => value == null || value.trim().isEmpty ? 'Login ID is required' : null,
                            ),
                            const SizedBox(height: 14),
                            _Field(
                              label: 'Password',
                              hint: 'Minimum 6 characters',
                              controller: passwordController,
                              obscureText: true,
                              validator: (value) {
                                if (value == null || value.trim().isEmpty) {
                                  return 'Password is required';
                                }
                                if (value.trim().length < 6) {
                                  return 'Password must be at least 6 characters';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 14),
                            _Field(
                              label: 'Default address',
                              hint: 'Aeden Bakes, North Industrial Estate',
                              controller: addressController,
                              maxLines: 2,
                              validator: (value) => value == null || value.trim().isEmpty ? 'Default address is required' : null,
                            ),
                            const SizedBox(height: 16),
                            if (error != null) _Banner(text: error!, tone: _BannerTone.bad),
                            const SizedBox(height: 16),
                            FilledButton(
                              onPressed: loading ? null : () => onOnboard(),
                              child: SizedBox(
                                width: double.infinity,
                                child: Center(child: Text(loading ? 'Creating...' : 'Create customer')),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.title,
    required this.subtitle,
    required this.statusLabel,
    required this.statusValue,
    required this.detailLabel,
    required this.detailValue,
  });

  final String title;
  final String subtitle;
  final String statusLabel;
  final String statusValue;
  final String detailLabel;
  final String detailValue;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFFE7D3), Color(0xFFFFF9F4)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          Text(subtitle),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _MetricPill(label: statusLabel, value: statusValue)),
              const SizedBox(width: 12),
              Expanded(child: _MetricPill(label: detailLabel, value: detailValue)),
            ],
          ),
        ],
      ),
    );
  }
}

class _MetricPill extends StatelessWidget {
  const _MetricPill({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 4),
          Text(value, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }
}

class _AccountCard extends StatelessWidget {
  const _AccountCard({required this.customer, required this.auth});

  final _CustomerAccount customer;
  final _CustomerAuth auth;

  @override
  Widget build(BuildContext context) {
    return _CardSection(
      title: 'Account',
      subtitle: 'The customer identity used by production and delivery.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(customer.name, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Tag(text: customer.tier),
              _Tag(text: customer.deliveryZone),
              _Tag(text: 'Risk: ${customer.riskStateLabel}'),
            ],
          ),
          const SizedBox(height: 14),
          Text('Login ID: ${auth.loginId}'),
          Text('Address: ${auth.defaultAddress ?? customer.deliveryZone}'),
          Text('Outstanding: Rs. ${customer.outstandingBalance.toStringAsFixed(0)}'),
          Text('Credit limit: Rs. ${customer.creditLimit.toStringAsFixed(0)}'),
        ],
      ),
    );
  }
}

class _ServiceabilityCard extends StatelessWidget {
  const _ServiceabilityCard({
    required this.serviceability,
    required this.selectedSlotId,
    required this.onSlotSelected,
  });

  final _CustomerServiceability serviceability;
  final String? selectedSlotId;
  final ValueChanged<String> onSlotSelected;

  @override
  Widget build(BuildContext context) {
    return _CardSection(
      title: 'Serviceability',
      subtitle: 'Only live slots and capacity appear here.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (serviceability.reasons.isNotEmpty) ...[
            for (final reason in serviceability.reasons)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _Banner(text: reason, tone: _BannerTone.bad),
              ),
            const SizedBox(height: 8),
          ],
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: serviceability.slots.map((slot) {
              final selected = slot.slotId == selectedSlotId;
              return ChoiceChip(
                selected: selected,
                label: Text('${slot.label} • ${slot.zone}'),
                onSelected: slot.available ? (_) => onSlotSelected(slot.slotId) : null,
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          Text(
            serviceability.canOrder ? 'Ordering is open for ${serviceability.defaultServiceDate}.' : 'Ordering is blocked until the guardrails clear.',
          ),
        ],
      ),
    );
  }
}

class _CatalogCard extends StatelessWidget {
  const _CatalogCard({
    required this.dashboard,
    required this.cart,
    required this.onAdd,
    required this.onRemove,
  });

  final _CustomerDashboard dashboard;
  final Map<String, int> cart;
  final ValueChanged<String> onAdd;
  final ValueChanged<String> onRemove;

  @override
  Widget build(BuildContext context) {
    return _CardSection(
      title: 'Catalog',
      subtitle: 'Move quantities into the cart against live capacity.',
      child: Column(
        children: dashboard.catalogProducts.map((product) {
          final capacity = dashboard.capacityByProductId[product.id];
          final inCart = cart[product.id] ?? 0;
          final remaining = capacity?.remainingQuantity ?? 0;
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.86),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFF1E5D9)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(product.name, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 4),
                        Text(product.category),
                        const SizedBox(height: 6),
                        Text('Rs. ${product.unitPrice.toStringAsFixed(0)}'),
                        Text('Remaining: $remaining'),
                      ],
                    ),
                  ),
                  Column(
                    children: [
                      IconButton(
                        onPressed: inCart > 0 ? () => onRemove(product.id) : null,
                        icon: const Icon(Icons.remove_circle_outline),
                      ),
                      Text('$inCart', style: const TextStyle(fontWeight: FontWeight.w900)),
                      IconButton(
                        onPressed: remaining > inCart ? () => onAdd(product.id) : null,
                        icon: const Icon(Icons.add_circle_outline),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _CheckoutCard extends StatelessWidget {
  const _CheckoutCard({
    required this.paymentMode,
    required this.cartCount,
    required this.cartTotal,
    required this.canSubmit,
    required this.serviceabilityReasons,
    required this.onPaymentModeChanged,
    required this.onSubmit,
  });

  final String paymentMode;
  final int cartCount;
  final double cartTotal;
  final bool canSubmit;
  final List<String> serviceabilityReasons;
  final ValueChanged<String> onPaymentModeChanged;
  final Future<void> Function() onSubmit;

  @override
  Widget build(BuildContext context) {
    return _CardSection(
      title: 'Checkout',
      subtitle: 'Confirm the basket only after the route and capacity checks hold.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            children: _paymentModes.map((mode) {
              final selected = mode == paymentMode;
              return ChoiceChip(
                selected: selected,
                label: Text(_paymentModeLabel(mode)),
                onSelected: (_) => onPaymentModeChanged(mode),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),
          Text('Items: $cartCount'),
          Text('Total: Rs. ${cartTotal.toStringAsFixed(0)}'),
          if (serviceabilityReasons.isNotEmpty) ...[
            const SizedBox(height: 12),
            for (final reason in serviceabilityReasons)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _Banner(text: reason, tone: _BannerTone.bad),
              ),
          ],
          const SizedBox(height: 12),
          FilledButton(
            onPressed: canSubmit ? () => onSubmit() : null,
            child: SizedBox(
              width: double.infinity,
              child: Center(child: Text(canSubmit ? 'Place order' : 'Resolve guardrails first')),
            ),
          ),
        ],
      ),
    );
  }

  static const _paymentModes = <String>['prepaid', 'part-pay', 'credit'];

  static String _paymentModeLabel(String mode) {
    return switch (mode) {
      'part-pay' => 'Part pay',
      'credit' => 'Credit',
      _ => 'Prepaid',
    };
  }
}

class _OrdersCard extends StatelessWidget {
  const _OrdersCard({required this.orders});

  final List<_Order> orders;

  @override
  Widget build(BuildContext context) {
    return _CardSection(
      title: 'Order history',
      subtitle: 'The latest confirmed orders from the bakery system.',
      child: orders.isEmpty
          ? const _EmptyState(message: 'No orders yet.')
          : Column(
              children: orders.map((order) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.86),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFF1E5D9)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(order.id, style: const TextStyle(fontWeight: FontWeight.w900)),
                            Text(order.createdAt),
                            Text('${order.statusLabel} • ${order.paymentModeLabel}'),
                          ],
                        ),
                        Text('Rs. ${order.amountTotal.toStringAsFixed(0)}'),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
    );
  }
}

class _CardSection extends StatelessWidget {
  const _CardSection({
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
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.86),
        borderRadius: BorderRadius.circular(24),
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
          Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          Text(subtitle),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.text, required this.tone});

  final String text;
  final _BannerTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = switch (tone) {
      _BannerTone.good => (const Color(0xFFE7F6EC), const Color(0xFF0F6A35)),
      _BannerTone.bad => (const Color(0xFFFBE7E7), const Color(0xFF8D1F1F)),
    };

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.$1,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(text, style: TextStyle(color: colors.$2)),
    );
  }
}

enum _BannerTone { good, bad }

class _Tag extends StatelessWidget {
  const _Tag({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF1E6),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({
    required this.label,
    required this.controller,
    required this.validator,
    this.hint,
    this.obscureText = false,
    this.maxLines = 1,
  });

  final String label;
  final String? hint;
  final TextEditingController controller;
  final String? Function(String? value) validator;
  final bool obscureText;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      validator: validator,
      obscureText: obscureText,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(18)),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F0E6),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Text(message),
    );
  }
}

class _LoadingScreen extends StatelessWidget {
  const _LoadingScreen({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(child: Text(message)),
    );
  }
}

class _CustomerDashboard {
  _CustomerDashboard({
    required this.customer,
    required this.auth,
    required this.orders,
    required this.catalogProducts,
    required this.catalogCapacities,
    required this.catalogSlots,
    required this.serviceability,
    required this.defaultServiceDate,
  });

  final _CustomerAccount customer;
  final _CustomerAuth auth;
  final List<_Order> orders;
  final List<_Product> catalogProducts;
  final List<_Capacity> catalogCapacities;
  final List<_Slot> catalogSlots;
  final _CustomerServiceability serviceability;
  final String defaultServiceDate;

  Map<String, _Product> get productById => {for (final product in catalogProducts) product.id: product};
  Map<String, _Capacity> get capacityByProductId => {for (final capacity in catalogCapacities) capacity.productId: capacity};

  factory _CustomerDashboard.fromJson(Map<String, dynamic> json) {
    final catalog = json['catalog'] as Map<String, dynamic>? ?? const {};
    final serviceability = json['serviceability'] as Map<String, dynamic>? ?? const {};
    return _CustomerDashboard(
      customer: _CustomerAccount.fromJson(json['customer'] as Map<String, dynamic>? ?? const {}),
      auth: _CustomerAuth.fromJson(json['auth'] as Map<String, dynamic>? ?? const {}),
      orders: (json['orders'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(_Order.fromJson)
          .toList(growable: false),
      catalogProducts: (catalog['products'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(_Product.fromJson)
          .toList(growable: false),
      catalogCapacities: (catalog['capacities'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(_Capacity.fromJson)
          .toList(growable: false),
      catalogSlots: (catalog['slots'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(_Slot.fromJson)
          .toList(growable: false),
      serviceability: _CustomerServiceability.fromJson(serviceability),
      defaultServiceDate: json['defaultServiceDate'] as String? ?? '',
    );
  }
}

class _CustomerAccount {
  _CustomerAccount({
    required this.id,
    required this.name,
    required this.tier,
    required this.creditLimit,
    required this.outstandingBalance,
    required this.riskState,
    required this.deliveryZone,
  });

  final String id;
  final String name;
  final String tier;
  final double creditLimit;
  final double outstandingBalance;
  final String riskState;
  final String deliveryZone;

  String get riskStateLabel => riskState.replaceAll('_', ' ');

  factory _CustomerAccount.fromJson(Map<String, dynamic> json) {
    return _CustomerAccount(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      tier: json['tier'] as String? ?? 'Tier C',
      creditLimit: (json['creditLimit'] as num?)?.toDouble() ?? 0,
      outstandingBalance: (json['outstandingBalance'] as num?)?.toDouble() ?? 0,
      riskState: json['riskState'] as String? ?? 'healthy',
      deliveryZone: json['deliveryZone'] as String? ?? '',
    );
  }
}

class _CustomerAuth {
  _CustomerAuth({required this.loginId, required this.defaultAddress, required this.deliveryZone});

  final String loginId;
  final String? defaultAddress;
  final String? deliveryZone;

  factory _CustomerAuth.fromJson(Map<String, dynamic> json) {
    return _CustomerAuth(
      loginId: json['loginId'] as String? ?? '',
      defaultAddress: json['defaultAddress'] as String?,
      deliveryZone: json['deliveryZone'] as String?,
    );
  }
}

class _Product {
  _Product({required this.id, required this.name, required this.category, required this.unitPrice});

  final String id;
  final String name;
  final String category;
  final double unitPrice;

  factory _Product.fromJson(Map<String, dynamic> json) {
    return _Product(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      category: json['category'] as String? ?? '',
      unitPrice: (json['unitPrice'] as num?)?.toDouble() ?? 0,
    );
  }
}

class _Capacity {
  _Capacity({
    required this.productId,
    required this.capacity,
    required this.bookedQuantity,
  });

  final String productId;
  final int capacity;
  final int bookedQuantity;

  int get remainingQuantity => capacity - bookedQuantity;

  factory _Capacity.fromJson(Map<String, dynamic> json) {
    return _Capacity(
      productId: json['productId'] as String? ?? '',
      capacity: (json['capacity'] as num?)?.toInt() ?? 0,
      bookedQuantity: (json['bookedQuantity'] as num?)?.toInt() ?? 0,
    );
  }
}

class _Slot {
  _Slot({
    required this.slotId,
    required this.label,
    required this.zone,
    required this.available,
  });

  final String slotId;
  final String label;
  final String zone;
  final bool available;

  factory _Slot.fromJson(Map<String, dynamic> json) {
    return _Slot(
      slotId: json['slotId'] as String? ?? '',
      label: json['label'] as String? ?? '',
      zone: json['zone'] as String? ?? '',
      available: json['available'] as bool? ?? false,
    );
  }
}

class _CustomerServiceability {
  _CustomerServiceability({
    required this.canOrder,
    required this.reasons,
    required this.slots,
    required this.availableSlots,
    required this.capacities,
    required this.defaultServiceDate,
  });

  final bool canOrder;
  final List<String> reasons;
  final List<_Slot> slots;
  final List<_Slot> availableSlots;
  final List<_Capacity> capacities;
  final String defaultServiceDate;

  factory _CustomerServiceability.fromJson(Map<String, dynamic> json) {
    final slots = (json['slots'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(_Slot.fromJson)
        .toList(growable: false);
    final capacities = (json['capacities'] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(_Capacity.fromJson)
        .toList(growable: false);
    return _CustomerServiceability(
      canOrder: json['canOrder'] as bool? ?? false,
      reasons: (json['reasons'] as List<dynamic>? ?? const []).map((entry) => entry.toString()).toList(growable: false),
      slots: slots,
      availableSlots: slots.where((slot) => slot.available).toList(growable: false),
      capacities: capacities,
      defaultServiceDate: json['defaultServiceDate'] as String? ?? '',
    );
  }
}

class _Order {
  _Order({
    required this.id,
    required this.status,
    required this.paymentMode,
    required this.amountTotal,
    required this.createdAt,
  });

  final String id;
  final String status;
  final String paymentMode;
  final double amountTotal;
  final String createdAt;

  String get statusLabel => status.replaceAll('_', ' ');
  String get paymentModeLabel => paymentMode.replaceAll('-', ' ');

  factory _Order.fromJson(Map<String, dynamic> json) {
    return _Order(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'confirmed',
      paymentMode: json['paymentMode'] as String? ?? 'prepaid',
      amountTotal: (json['amountTotal'] as num?)?.toDouble() ?? 0,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}

extension<T> on List<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
