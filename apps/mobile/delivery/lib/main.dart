import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  runApp(const BakeryDeliveryApp());
}

const String _apiBaseUrl = 'http://127.0.0.1:4000';
const String _deliveryUsername = 'delivery';
const String _deliveryPassword = 'delivery123';

class BakeryDeliveryApp extends StatelessWidget {
  const BakeryDeliveryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Aeden Bakes Delivery',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF6A4D2F)),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF8F1E7),
      ),
      home: const DeliveryHome(),
    );
  }
}

class DeliveryHome extends StatefulWidget {
  const DeliveryHome({super.key});

  @override
  State<DeliveryHome> createState() => _DeliveryHomeState();
}

class _DeliveryHomeState extends State<DeliveryHome> {
  String? _token;
  bool _loading = true;
  bool _syncing = false;
  String? _error;
  _DeliverySnapshot? _snapshot;
  List<_QueuedDeliveryEvent> _queue = [];
  List<_QueuedDeliveryEvent> _failed = [];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _queue = _loadEvents(prefs.getStringList('delivery_outbox'));
      _failed = _loadEvents(prefs.getStringList('delivery_failed'));

      final loginResponse = await http.post(
        Uri.parse('$_apiBaseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': _deliveryUsername, 'password': _deliveryPassword}),
      );
      if (loginResponse.statusCode < 200 || loginResponse.statusCode >= 300) {
        throw Exception('Delivery login failed with status ${loginResponse.statusCode}');
      }

      final loginJson = jsonDecode(loginResponse.body) as Map<String, dynamic>;
      _token = loginJson['token'] as String?;
      await _refreshSnapshot();
      await _syncQueue();
    } catch (error) {
      _error = error.toString();
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _refreshSnapshot() async {
    final token = _token;
    if (token == null) {
      throw Exception('Missing delivery session token');
    }

    final responses = await Future.wait([
      http.get(Uri.parse('$_apiBaseUrl/delivery/manifest'), headers: _authHeaders(token)),
      http.get(Uri.parse('$_apiBaseUrl/orders'), headers: _authHeaders(token)),
      http.get(Uri.parse('$_apiBaseUrl/customers'), headers: _authHeaders(token)),
    ]);

    for (final response in responses) {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('API returned ${response.statusCode}');
      }
    }

    final manifestJson = jsonDecode(responses[0].body) as Map<String, dynamic>;
    final ordersJson = jsonDecode(responses[1].body) as Map<String, dynamic>;
    final customersJson = jsonDecode(responses[2].body) as Map<String, dynamic>;

    _snapshot = _DeliverySnapshot.fromJson(
      manifestJson,
      ordersJson: ordersJson,
      customersJson: customersJson,
    );

    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _queueEvent(_QueuedDeliveryEvent event) async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _queue = [..._queue, event];
    });
    await prefs.setStringList('delivery_outbox', _queue.map((entry) => jsonEncode(entry.toJson())).toList());
    await _syncQueue();
  }

  Future<void> _syncQueue() async {
    final token = _token;
    if (token == null || _queue.isEmpty) {
      return;
    }

    setState(() {
      _syncing = true;
    });

    try {
      final response = await http.post(
        Uri.parse('$_apiBaseUrl/delivery/writeback'),
        headers: {
          'Content-Type': 'application/json',
          ..._authHeaders(token),
        },
        body: jsonEncode({
          'events': _queue.map((entry) => entry.toJson()).toList(),
        }),
      );

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('Delivery writeback failed with status ${response.statusCode}');
      }

      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      final acceptedIds = Set<String>.from((payload['acceptedEventIds'] as List<dynamic>? ?? const []).cast<String>());
      final duplicateIds = Set<String>.from((payload['duplicateEventIds'] as List<dynamic>? ?? const []).cast<String>());
      final rejectedIds = Set<String>.from((payload['rejectedEventIds'] as List<dynamic>? ?? const []).cast<String>());

      final remaining = _queue
          .where(
            (entry) =>
                !acceptedIds.contains(entry.eventId) &&
                !duplicateIds.contains(entry.eventId) &&
                !rejectedIds.contains(entry.eventId),
          )
          .toList(growable: false);

      final failed = _queue
          .where((entry) => rejectedIds.contains(entry.eventId))
          .toList(growable: false);

      setState(() {
        _queue = remaining;
        _failed = [..._failed, ...failed];
        _error = null;
      });

      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList('delivery_outbox', _queue.map((entry) => jsonEncode(entry.toJson())).toList());
      await prefs.setStringList('delivery_failed', _failed.map((entry) => jsonEncode(entry.toJson())).toList());
      await _refreshSnapshot();
    } catch (error) {
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _syncing = false;
        });
      }
    }
  }

  Future<void> _markOrder({
    required String orderId,
    required String slotId,
    required _DeliveryAction action,
    required String note,
  }) async {
    final event = _QueuedDeliveryEvent(
      eventId: 'evt_${DateTime.now().microsecondsSinceEpoch}',
      orderId: orderId,
      slotId: slotId,
      action: action,
      note: note,
      capturedAt: DateTime.now().toIso8601String(),
    );

    await _queueEvent(event);
  }

  Map<String, String> _authHeaders(String token) => {'Authorization': 'Bearer $token'};

  List<_QueuedDeliveryEvent> _loadEvents(List<String>? raw) {
    if (raw == null) {
      return [];
    }

    return raw
        .map((entry) => _QueuedDeliveryEvent.fromJson(jsonDecode(entry) as Map<String, dynamic>))
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const _LoadingScreen(message: 'Signing into delivery...');
    }

    if (_error != null && _snapshot == null) {
      return _ErrorState(
        message: 'Could not load the live delivery manifest.',
        details: _error!,
        onRetry: _bootstrap,
      );
    }

    final snapshot = _snapshot;
    if (snapshot == null) {
      return const _ErrorState(
        message: 'Delivery data was empty.',
        details: 'The API responded without route or order data.',
      );
    }

    final queueCount = _queue.length;
    final failedCount = _failed.length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Route manifest'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Chip(label: Text(queueCount > 0 ? '$queueCount queued' : 'Offline sync ready')),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await _refreshSnapshot();
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _HeroCard(
              title: 'The delivery app keeps the route honest.',
              subtitle:
                  'Drivers see stop order, proof-of-delivery, shortages, and return captures in one flow.',
              statLabel: 'Stops',
              statValue: '${snapshot.routes.length} today',
              queueLabel: 'Queued',
              queueValue: '$queueCount',
            ),
            const SizedBox(height: 12),
            _ActionBanner(
              text: failedCount > 0
                  ? '$failedCount offline writes need review.'
                  : 'Queued actions stay local until the API accepts them.',
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              _ActionBanner(text: _error!, tone: _BannerTone.bad),
            ],
            const SizedBox(height: 16),
            _SectionTitle(
              title: 'Stops',
              subtitle: 'Route order and current status.',
            ),
            const SizedBox(height: 12),
            ...snapshot.routes.map(
              (route) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _RouteCard(
                  route: route,
                  onPod: (order) => _markOrder(
                    orderId: order.id,
                    slotId: route.routeId,
                    action: _DeliveryAction.podCompleted,
                    note: 'POD captured from delivery app.',
                  ),
                  onFail: (order) => _markOrder(
                    orderId: order.id,
                    slotId: route.routeId,
                    action: _DeliveryAction.deliveryFailed,
                    note: 'Driver could not complete the drop.',
                  ),
                  onReturn: (order) => _markOrder(
                    orderId: order.id,
                    slotId: route.routeId,
                    action: _DeliveryAction.returnCaptured,
                    note: 'Return captured at doorstep.',
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            _SectionTitle(
              title: 'Delivery exceptions',
              subtitle: 'Failed drops and returns need immediate capture.',
            ),
            const SizedBox(height: 12),
            _ActionCard(
              title: 'Proof of delivery',
              body: 'Capture photo or signature before closing a stop.',
            ),
            const SizedBox(height: 12),
            _ActionCard(
              title: 'Exception handling',
              body: 'Record short delivery, failed delivery, or customer return on the spot.',
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: queueCount > 0 ? _syncQueue : null,
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 14),
                child: Text(_syncing ? 'Syncing...' : 'Sync queued updates'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DeliverySnapshot {
  const _DeliverySnapshot({required this.routes});

  final List<_DeliveryRoute> routes;

  factory _DeliverySnapshot.fromJson(
    Map<String, dynamic> manifestJson, {
    required Map<String, dynamic> ordersJson,
    required Map<String, dynamic> customersJson,
  }) {
    final customerById = {
      for (final entry in (customersJson['customers'] as List<dynamic>? ?? const []))
        (entry as Map<String, dynamic>)['id'] as String? ?? '': _Customer.fromJson(entry as Map<String, dynamic>),
    };

    final orderGroups = <String, List<_OrderSummary>>{};
    for (final orderEntry in (ordersJson['orders'] as List<dynamic>? ?? const [])) {
      final orderJson = orderEntry as Map<String, dynamic>;
      final order = _OrderSummary.fromJson(orderJson, customerById: customerById);
      orderGroups.putIfAbsent(order.slotId, () => []).add(order);
    }
    for (final orders in orderGroups.values) {
      orders.sort((left, right) => left.id.compareTo(right.id));
    }

    final routes = (manifestJson['routes'] as List<dynamic>? ?? const [])
        .map((entry) => _DeliveryRoute.fromJson(entry as Map<String, dynamic>, orders: orderGroups))
        .toList(growable: false);

    return _DeliverySnapshot(routes: routes);
  }
}

class _DeliveryRoute {
  const _DeliveryRoute({
    required this.routeId,
    required this.label,
    required this.zone,
    required this.orderCount,
    required this.orders,
    required this.completedOrders,
    required this.failedOrders,
  });

  final String routeId;
  final String label;
  final String zone;
  final int orderCount;
  final List<_OrderSummary> orders;
  final int completedOrders;
  final int failedOrders;

  factory _DeliveryRoute.fromJson(
    Map<String, dynamic> json, {
    required Map<String, List<_OrderSummary>> orders,
  }) {
    final slotId = json['slotId'] as String? ?? '';
    final routeOrders = [...(orders[slotId] ?? const [])]
      ..sort((left, right) => left.id.compareTo(right.id));
    final List<_OrderSummary> numberedOrders = routeOrders
        .asMap()
        .entries
        .map<_OrderSummary>((entry) => entry.value.copyWith(sequence: entry.key + 1))
        .toList(growable: false);
    return _DeliveryRoute(
      routeId: slotId,
      label: json['label'] as String? ?? '',
      zone: json['zone'] as String? ?? '',
      orderCount: (json['orderCount'] as num?)?.toInt() ?? 0,
      completedOrders: (json['completedOrders'] as num?)?.toInt() ?? 0,
      failedOrders: (json['failedOrders'] as num?)?.toInt() ?? 0,
      orders: numberedOrders,
    );
  }
}

class _OrderSummary {
  const _OrderSummary({
    required this.id,
    required this.customerName,
    required this.slotId,
    required this.status,
    required this.amountTotal,
    required this.sequence,
  });

  final String id;
  final String customerName;
  final String slotId;
  final String status;
  final int amountTotal;
  final int sequence;

  factory _OrderSummary.fromJson(
    Map<String, dynamic> json, {
    required Map<String, _Customer> customerById,
  }) {
    final customerId = json['customerId'] as String? ?? '';
    return _OrderSummary(
      id: json['id'] as String? ?? 'unknown',
      customerName: customerById[customerId]?.name ?? customerId,
      slotId: json['slotId'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      amountTotal: (json['amountTotal'] as num?)?.toInt() ?? 0,
      sequence: (json['sequence'] as num?)?.toInt() ?? 0,
    );
  }

  _OrderSummary copyWith({int? sequence}) {
    return _OrderSummary(
      id: id,
      customerName: customerName,
      slotId: slotId,
      status: status,
      amountTotal: amountTotal,
      sequence: sequence ?? this.sequence,
    );
  }
}

class _Customer {
  const _Customer({required this.name});

  final String name;

  factory _Customer.fromJson(Map<String, dynamic> json) {
    return _Customer(name: json['name'] as String? ?? 'Unknown customer');
  }
}

enum _DeliveryAction { podCompleted, deliveryFailed, returnCaptured }

class _QueuedDeliveryEvent {
  const _QueuedDeliveryEvent({
    required this.eventId,
    required this.orderId,
    required this.slotId,
    required this.action,
    required this.note,
    required this.capturedAt,
  });

  final String eventId;
  final String orderId;
  final String slotId;
  final _DeliveryAction action;
  final String note;
  final String capturedAt;

  Map<String, dynamic> toJson() {
    return {
      'eventId': eventId,
      'orderId': orderId,
      'slotId': slotId,
      'action': switch (action) {
        _DeliveryAction.podCompleted => 'pod_completed',
        _DeliveryAction.deliveryFailed => 'delivery_failed',
        _DeliveryAction.returnCaptured => 'return_captured',
      },
      'note': note,
      'capturedAt': capturedAt,
    };
  }

  factory _QueuedDeliveryEvent.fromJson(Map<String, dynamic> json) {
    return _QueuedDeliveryEvent(
      eventId: json['eventId'] as String? ?? '',
      orderId: json['orderId'] as String? ?? '',
      slotId: json['slotId'] as String? ?? '',
      action: switch (json['action'] as String? ?? '') {
        'pod_completed' => _DeliveryAction.podCompleted,
        'delivery_failed' => _DeliveryAction.deliveryFailed,
        _ => _DeliveryAction.returnCaptured,
      },
      note: json['note'] as String? ?? '',
      capturedAt: json['capturedAt'] as String? ?? '',
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.title,
    required this.subtitle,
    required this.statLabel,
    required this.statValue,
    required this.queueLabel,
    required this.queueValue,
  });

  final String title;
  final String subtitle;
  final String statLabel;
  final String statValue;
  final String queueLabel;
  final String queueValue;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFFE8D5), Color(0xFFFFFAF4)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          Text(subtitle),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(child: _MetricPill(label: statLabel, value: statValue)),
              const SizedBox(width: 12),
              Expanded(child: _MetricPill(label: queueLabel, value: queueValue)),
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
          Text(value, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 2),
        Text(subtitle),
      ],
    );
  }
}

class _RouteCard extends StatelessWidget {
  const _RouteCard({
    required this.route,
    required this.onPod,
    required this.onFail,
  required this.onReturn,
  });

  final _DeliveryRoute route;
  final void Function(_OrderSummary order) onPod;
  final void Function(_OrderSummary order) onFail;
  final void Function(_OrderSummary order) onReturn;

  @override
  Widget build(BuildContext context) {
    final badgeColor = route.orderCount >= 14
        ? Colors.red.shade100
        : route.orderCount >= 10
            ? Colors.amber.shade100
            : Colors.green.shade100;

    return Card(
      elevation: 0,
      color: Colors.white.withValues(alpha: 0.9),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(route.label, style: Theme.of(context).textTheme.titleMedium),
                    Text('${route.zone} zone', style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: badgeColor,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text('${route.orderCount} stops', style: const TextStyle(fontWeight: FontWeight.w700)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (route.orders.isEmpty)
              Text(
                'No orders mapped to this route yet.',
                style: Theme.of(context).textTheme.bodyMedium,
              )
            else
              ...route.orders.map(
                (order) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(order.id, style: Theme.of(context).textTheme.titleMedium),
                            Text(order.status, style: const TextStyle(fontWeight: FontWeight.w700)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text('${order.customerName} | Rs. ${order.amountTotal}'),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            OutlinedButton(
                              onPressed: () => onPod(order),
                              child: const Text('POD complete'),
                            ),
                            OutlinedButton(
                              onPressed: () => onFail(order),
                              child: const Text('Mark failed'),
                            ),
                            OutlinedButton(
                              onPressed: () => onReturn(order),
                              child: const Text('Capture return'),
                            ),
                          ],
                        ),
                      ],
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

class _ActionCard extends StatelessWidget {
  const _ActionCard({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(body),
        ],
      ),
    );
  }
}

enum _BannerTone { normal, bad }

class _ActionBanner extends StatelessWidget {
  const _ActionBanner({required this.text, this.tone = _BannerTone.normal});

  final String text;
  final _BannerTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = tone == _BannerTone.bad
        ? (Colors.red.shade50, Colors.red.shade900)
        : (Colors.grey.shade50, Colors.grey.shade800);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.$1,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(text, style: TextStyle(color: colors.$2)),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.details, this.onRetry});

  final String message;
  final String details;
  final Future<void> Function()? onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  message,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Text(details),
                const SizedBox(height: 16),
                if (onRetry != null)
                  FilledButton(
                    onPressed: () {
                      onRetry!();
                    },
                    child: const Text('Retry'),
                  ),
              ],
            ),
          ),
        ),
      ),
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
