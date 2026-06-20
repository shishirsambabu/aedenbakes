import 'dart:convert';

import 'package:aeden_brand/aeden_brand.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const AedenDeliveryApp());
}

const String _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://127.0.0.1:4000',
);
const String _deliveryUsername = String.fromEnvironment(
  'DELIVERY_USERNAME',
  defaultValue: 'delivery',
);
const String _deliveryPassword = String.fromEnvironment(
  'DELIVERY_PASSWORD',
  defaultValue: 'delivery123',
);

class AedenDeliveryApp extends StatelessWidget {
  const AedenDeliveryApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Aeden Bakes Delivery',
      theme: buildAedenBrandTheme(),
      home: const DeliveryShell(),
    );
  }
}

class DeliveryShell extends StatefulWidget {
  const DeliveryShell({super.key});

  @override
  State<DeliveryShell> createState() => _DeliveryShellState();
}

class _DeliveryShellState extends State<DeliveryShell> {
  int _tabIndex = 0;
  bool _loading = true;
  String? _error;
  String? _token;
  String _manifestStatus = 'draft';
  String _manifestNote = 'Generated from live route load.';
  int _manifestRouteCount = 0;
  int _queuedServerCount = 0;
  final List<_QueuedDeliveryAction> _queuedActions = [];

  List<_DeliveryTask> _tasks = [
    _DeliveryTask(
      stopNumber: 1,
      slotId: 'slot_morning',
      orderId: 'ORD-1045',
      customer: 'Hotel Crescent',
      address: 'Marine Drive Service Lane',
      slot: '6:00 - 8:00 AM',
      status: 'Ready',
      accent: AedenPalette.goldBright,
      note: 'Call before gate entry.',
    ),
    _DeliveryTask(
      stopNumber: 2,
      slotId: 'slot_morning',
      orderId: 'ORD-1048',
      customer: 'Cafe Meraki',
      address: 'Panampilly Nagar',
      slot: '8:00 - 10:00 AM',
      status: 'On route',
      accent: AedenPalette.gold,
      note: 'Leave at reception if unresponsive.',
    ),
    _DeliveryTask(
      stopNumber: 3,
      slotId: 'slot_midday',
      orderId: 'ORD-1051',
      customer: 'Bakery House',
      address: 'Edappally',
      slot: '10:00 - 12:00 PM',
      status: 'Exception',
      accent: AedenPalette.red,
      note: 'Customer unavailable. Return pending.',
    ),
    _DeliveryTask(
      stopNumber: 4,
      slotId: 'slot_afternoon',
      orderId: 'ORD-1054',
      customer: 'Orchid Towers',
      address: 'Vyttila Junction',
      slot: '12:00 - 2:00 PM',
      status: 'Ready',
      accent: AedenPalette.green,
      note: 'Photo POD required at lobby desk.',
    ),
  ];

  int get _readyCount => _tasks.where((task) => task.status == 'Ready').length;
  int get _routeCount =>
      _tasks.where((task) => task.status == 'On route').length;
  int get _exceptionCount =>
      _tasks.where((task) => task.status == 'Exception').length;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final loginResponse = await http.post(
        Uri.parse('$_apiBaseUrl/auth/login'),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': _deliveryUsername,
          'password': _deliveryPassword,
        }),
      );
      if (loginResponse.statusCode < 200 || loginResponse.statusCode >= 300) {
        throw Exception('Delivery login failed with status ${loginResponse.statusCode}');
      }

      final loginJson = jsonDecode(loginResponse.body) as Map<String, dynamic>;
      _token = loginJson['token'] as String?;
      await _refreshTasks();
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Map<String, String> _authHeaders() {
    final token = _token;
    if (token == null) {
      return const {'Content-Type': 'application/json'};
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  Color _accentForStatus(String status) {
    switch (status) {
      case 'delivered':
        return AedenPalette.green;
      case 'failed_delivery':
        return AedenPalette.red;
      case 'partial_delivery':
        return AedenPalette.gold;
      default:
        return AedenPalette.goldBright;
    }
  }

  Future<void> _refreshTasks() async {
    final token = _token;
    if (token == null) {
      throw Exception('Missing delivery session token');
    }

    final response = await http.get(
      Uri.parse('$_apiBaseUrl/delivery/manifest'),
      headers: _authHeaders(),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Delivery manifest failed with status ${response.statusCode}');
    }

    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    final manifest = payload['manifest'] as Map<String, dynamic>? ?? const {};
    final routes = (payload['routes'] as List<dynamic>? ?? const []);
    final tasks = <_DeliveryTask>[];
    for (final route in routes) {
      final routeMap = route as Map<String, dynamic>;
      final stops = routeMap['stops'] as List<dynamic>? ?? const [];
      for (final stop in stops) {
        final stopMap = stop as Map<String, dynamic>;
        tasks.add(
          _DeliveryTask(
            stopNumber: stopMap['stopNumber'] as int? ?? tasks.length + 1,
            slotId: routeMap['slotId'] as String? ?? '',
            orderId: stopMap['orderId'] as String? ?? 'unknown',
            customer: stopMap['customerName'] as String? ?? 'Unknown customer',
            address: stopMap['address'] as String? ?? 'Address unavailable',
            slot: routeMap['label'] as String? ?? 'Route',
            status: stopMap['status'] as String? ?? 'Ready',
            accent: _accentForStatus(stopMap['status'] as String? ?? 'Ready'),
            note: stopMap['note'] as String? ?? 'Ready for handoff.',
          ),
        );
      }
    }

    if (tasks.isEmpty) {
      tasks.addAll(_tasks);
    }

    if (mounted) {
      setState(() {
        _tasks = tasks;
        _manifestStatus = manifest['status'] as String? ?? 'draft';
        _manifestNote = manifest['note'] as String? ?? 'Generated from live route load.';
        _manifestRouteCount = (manifest['routeCount'] as num?)?.toInt() ?? tasks.length;
        _queuedServerCount = (payload['outboxCount'] as num?)?.toInt() ?? 0;
        _error = null;
      });
    }
  }

  Future<void> _queueOrSendDeliveryAction(_QueuedDeliveryAction action) async {
    try {
      final response = await http.post(
        Uri.parse('$_apiBaseUrl/delivery/writeback'),
        headers: _authHeaders(),
        body: jsonEncode({
          'events': [action.toJson()],
        }),
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('Writeback failed with status ${response.statusCode}');
      }
      if (!mounted) {
        return;
      }
      setState(() {
        _tasks = _tasks
            .map(
              (entry) => entry.orderId == action.orderId
                  ? entry.copyWith(
                      status: action.statusLabel,
                      accent: action.accent,
                    )
                  : entry,
            )
            .toList(growable: false);
        _queuedActions.removeWhere((queued) => queued.eventId == action.eventId);
      });
      await _refreshTasks();
    } catch (_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _queuedActions.removeWhere((queued) => queued.eventId == action.eventId);
        _queuedActions.add(action);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Queued offline: ${action.label} for ${action.orderId}')),
      );
    }
  }

  Future<void> _openProofDialog(_DeliveryTask task, DeliveryActionKind kind) async {
    final noteController = TextEditingController(
      text: kind == DeliveryActionKind.pod
          ? 'Proof of delivery captured from the driver lane.'
          : kind == DeliveryActionKind.failure
              ? 'Delivery could not be completed at the door.'
              : 'Return captured while the parcel was still traceable.',
    );
    final signatureController = TextEditingController(text: 'Receiver signature');
    final photoController = TextEditingController(text: 'photo://doorstep/${task.orderId}');
    final reasonController = TextEditingController(text: 'customer_unavailable');
    final returnController = TextEditingController(text: '1');
    final result = await showDialog<_QueuedDeliveryAction>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(
            kind == DeliveryActionKind.pod
                ? 'Capture POD'
                : kind == DeliveryActionKind.failure
                    ? 'Mark failure'
                    : 'Capture return',
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: noteController,
                  decoration: const InputDecoration(labelText: 'Note'),
                  maxLines: 2,
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: signatureController,
                  decoration: const InputDecoration(labelText: 'Signature name'),
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: photoController,
                  decoration: const InputDecoration(labelText: 'Photo reference'),
                ),
                if (kind != DeliveryActionKind.pod) ...[
                  const SizedBox(height: 10),
                  TextField(
                    controller: reasonController,
                    decoration: const InputDecoration(labelText: 'Reason code'),
                  ),
                ],
                if (kind == DeliveryActionKind.returnCapture) ...[
                  const SizedBox(height: 10),
                  TextField(
                    controller: returnController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Return quantity'),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                final action = kind == DeliveryActionKind.pod
                    ? 'pod_completed'
                    : kind == DeliveryActionKind.failure
                        ? 'delivery_failed'
                        : 'return_captured';
                Navigator.pop(
                  context,
                  _QueuedDeliveryAction(
                    eventId: '${action}_${task.orderId}_${DateTime.now().millisecondsSinceEpoch}',
                    orderId: task.orderId,
                    slotId: task.slotId,
                    action: action,
                    note: noteController.text.trim(),
                    capturedAt: DateTime.now().toIso8601String(),
                    statusLabel: kind == DeliveryActionKind.pod
                        ? 'Delivered'
                        : kind == DeliveryActionKind.failure
                            ? 'Failed'
                            : 'Return captured',
                    accent: kind == DeliveryActionKind.pod
                        ? AedenPalette.green
                        : kind == DeliveryActionKind.failure
                            ? AedenPalette.red
                            : AedenPalette.gold,
                    signatureName: signatureController.text.trim(),
                    photoUrl: photoController.text.trim(),
                    reasonCode: reasonController.text.trim(),
                    returnQuantity: int.tryParse(returnController.text.trim()) ?? 1,
                  ),
                );
              },
              child: const Text('Save'),
            ),
          ],
        );
      },
    );

    if (result != null) {
      await _queueOrSendDeliveryAction(result);
    }
  }

  void _markPodComplete(String orderId) {
    final task = _tasks.firstWhere((entry) => entry.orderId == orderId);
    _openProofDialog(task, DeliveryActionKind.pod);
  }

  void _markFailed(String orderId) {
    final task = _tasks.firstWhere((entry) => entry.orderId == orderId);
    _openProofDialog(task, DeliveryActionKind.failure);
  }

  void _captureReturn(String orderId) {
    final task = _tasks.firstWhere((entry) => entry.orderId == orderId);
    _openProofDialog(task, DeliveryActionKind.returnCapture);
  }

  Future<void> _startRun() async {
    try {
      final response = await http.post(
        Uri.parse('$_apiBaseUrl/delivery/manifest/lock'),
        headers: _authHeaders(),
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('Could not lock manifest.');
      }
      await _refreshTasks();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Manifest locked for the route.')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    }
  }

  Future<void> _syncQueue() async {
    final messenger = ScaffoldMessenger.of(context);
    if (_queuedActions.isEmpty) {
      messenger.showSnackBar(const SnackBar(content: Text('Nothing waiting in the local queue.')));
      return;
    }

    final events = _queuedActions.map((action) => action.toJson()).toList(growable: false);
    final response = await http.post(
      Uri.parse('$_apiBaseUrl/delivery/writeback'),
      headers: _authHeaders(),
      body: jsonEncode({'events': events}),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Queue sync failed with status ${response.statusCode}');
    }
    if (!mounted) {
      return;
    }
    setState(() {
      _queuedActions.clear();
    });
    await _refreshTasks();
    if (!mounted) {
      return;
    }
    messenger.showSnackBar(const SnackBar(content: Text('Queued delivery actions synced.')));
  }

  void _reviewNotes() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Review notes opened.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AedenPalette.cream,
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null) {
      return Scaffold(
        backgroundColor: AedenPalette.cream,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              _error!,
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    final pages = [
      _OverviewSection(
        tasks: _tasks,
        readyCount: _readyCount,
        routeCount: _routeCount,
        exceptionCount: _exceptionCount,
        manifestStatus: _manifestStatus,
        manifestNote: _manifestNote,
        manifestRouteCount: _manifestRouteCount,
        queuedServerCount: _queuedServerCount,
        queuedLocalCount: _queuedActions.length,
        onStartRun: _startRun,
      ),
      _RouteSection(
        tasks: _tasks,
        onPodComplete: _markPodComplete,
        onMarkFailed: _markFailed,
        onCaptureReturn: _captureReturn,
      ),
      _QueueSection(
        tasks: _tasks,
        readyCount: _readyCount,
        routeCount: _routeCount,
        exceptionCount: _exceptionCount,
        queuedServerCount: _queuedServerCount,
        queuedLocalCount: _queuedActions.length,
        onSyncQueue: _syncQueue,
      ),
      _HandoffSection(
        tasks: _tasks,
        readyCount: _readyCount,
        exceptionCount: _exceptionCount,
        onReviewNotes: _reviewNotes,
        onPodComplete: _markPodComplete,
        onMarkFailed: _markFailed,
        onCaptureReturn: _captureReturn,
      ),
    ];

    return Scaffold(
      backgroundColor: AedenPalette.cream,
      body: SafeArea(child: pages[_tabIndex]),
      bottomNavigationBar: NavigationBar(
        backgroundColor: Colors.white,
        selectedIndex: _tabIndex,
        onDestinationSelected: (value) => setState(() => _tabIndex = value),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            label: 'Overview',
          ),
          NavigationDestination(
            icon: Icon(Icons.alt_route_outlined),
            label: 'Route',
          ),
          NavigationDestination(
            icon: Icon(Icons.inbox_outlined),
            label: 'Queue',
          ),
          NavigationDestination(
            icon: Icon(Icons.handshake_outlined),
            label: 'Handoff',
          ),
        ],
      ),
    );
  }
}

class _OverviewSection extends StatelessWidget {
  const _OverviewSection({
    required this.tasks,
    required this.readyCount,
    required this.routeCount,
    required this.exceptionCount,
    required this.manifestStatus,
    required this.manifestNote,
    required this.manifestRouteCount,
    required this.queuedServerCount,
    required this.queuedLocalCount,
    required this.onStartRun,
  });

  final List<_DeliveryTask> tasks;
  final int readyCount;
  final int routeCount;
  final int exceptionCount;
  final String manifestStatus;
  final String manifestNote;
  final int manifestRouteCount;
  final int queuedServerCount;
  final int queuedLocalCount;
  final Future<void> Function() onStartRun;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFFF8FAFC), AedenPalette.cream],
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
        children: [
          _HeaderCard(
            title: 'Delivery Ops',
            subtitle:
                'Route status, queue pressure, exceptions, and handoff actions in one place.',
            action: FilledButton(
              onPressed: () => onStartRun(),
              child: const Text('Start run'),
            ),
          ),
          const SizedBox(height: 16),
          _ManifestCard(
            status: manifestStatus,
            note: manifestNote,
            routeCount: manifestRouteCount,
            serverQueue: queuedServerCount,
            localQueue: queuedLocalCount,
          ),
          const SizedBox(height: 16),
          _HeroCard(
            tasks: tasks,
            readyCount: readyCount,
            routeCount: routeCount,
            exceptionCount: exceptionCount,
          ),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 2,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            childAspectRatio: 1.35,
            children: [
              _MetricCard(
                label: 'Stops',
                value: '${tasks.length}',
                tone: AedenPalette.goldBright,
              ),
              _MetricCard(
                label: 'Ready',
                value: '$readyCount',
                tone: AedenPalette.green,
              ),
              _MetricCard(
                label: 'On route',
                value: '$routeCount',
                tone: AedenPalette.gold,
              ),
              _MetricCard(
                label: 'Exceptions',
                value: '$exceptionCount',
                tone: AedenPalette.red,
              ),
            ],
          ),
          const SizedBox(height: 16),
          const _SectionTitle(
            title: 'Queue preview',
            subtitle: 'The next tap is ready to go for each stop.',
          ),
          const SizedBox(height: 12),
          _QueuePreviewCard(tasks: tasks),
        ],
      ),
    );
  }
}

class _RouteSection extends StatelessWidget {
  const _RouteSection({
    required this.tasks,
    required this.onPodComplete,
    required this.onMarkFailed,
    required this.onCaptureReturn,
  });

  final List<_DeliveryTask> tasks;
  final ValueChanged<String> onPodComplete;
  final ValueChanged<String> onMarkFailed;
  final ValueChanged<String> onCaptureReturn;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        _HeaderCard(
          title: 'Route Map',
          subtitle: 'Quick route overview tuned for the driver lane.',
          action: const _Pill(label: 'Live', tone: AedenPalette.green),
        ),
        const SizedBox(height: 14),
        _MapCard(tasks: tasks),
        const SizedBox(height: 16),
        const _SectionTitle(
          title: 'Stop actions',
          subtitle:
              'Tap through proof, failure, and return without leaving the route.',
        ),
        const SizedBox(height: 12),
        ...tasks.map(
          (task) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _StopCard(
              task: task,
              onPodComplete: () => onPodComplete(task.orderId),
              onMarkFailed: () => onMarkFailed(task.orderId),
              onCaptureReturn: () => onCaptureReturn(task.orderId),
            ),
          ),
        ),
      ],
    );
  }
}

class _QueueSection extends StatelessWidget {
  const _QueueSection({
    required this.tasks,
    required this.readyCount,
    required this.routeCount,
    required this.exceptionCount,
    required this.queuedServerCount,
    required this.queuedLocalCount,
    required this.onSyncQueue,
  });

  final List<_DeliveryTask> tasks;
  final int readyCount;
  final int routeCount;
  final int exceptionCount;
  final int queuedServerCount;
  final int queuedLocalCount;
  final Future<void> Function() onSyncQueue;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        _HeaderCard(
          title: 'Queue',
          subtitle:
              'Ready stops, in-flight deliveries, and exception items waiting for attention.',
          action: FilledButton.tonal(
            onPressed: () => onSyncQueue(),
            child: const Text('Sync queue'),
          ),
        ),
        const SizedBox(height: 14),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: AedenPalette.line),
            boxShadow: const [
              BoxShadow(
                color: Color(0x120F172A),
                blurRadius: 32,
                offset: Offset(0, 14),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Queue health',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 8),
              const Text(
                'Keep the queue short, keep proof current, and push exceptions immediately when they clear.',
                style: TextStyle(color: AedenPalette.grey, height: 1.5),
              ),
              const SizedBox(height: 14),
              _ManifestCard(
                status: queuedServerCount > 0 ? 'server queue' : 'synced',
                note: queuedServerCount > 0
                    ? '$queuedServerCount events are waiting on the server replay guard.'
                    : 'Server outbox is clear.',
                routeCount: tasks.length,
                serverQueue: queuedServerCount,
                localQueue: queuedLocalCount,
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: _MetricCard(
                      label: 'Ready',
                      value: '$readyCount',
                      tone: AedenPalette.goldBright,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _MetricCard(
                      label: 'In flight',
                      value: '$routeCount',
                      tone: AedenPalette.gold,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _MetricCard(
                      label: 'Issues',
                      value: '$exceptionCount',
                      tone: AedenPalette.red,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        ...tasks.map(
          (task) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _QueueRow(task: task),
          ),
        ),
      ],
    );
  }
}

class _HandoffSection extends StatelessWidget {
  const _HandoffSection({
    required this.tasks,
    required this.readyCount,
    required this.exceptionCount,
    required this.onReviewNotes,
    required this.onPodComplete,
    required this.onMarkFailed,
    required this.onCaptureReturn,
  });

  final List<_DeliveryTask> tasks;
  final int readyCount;
  final int exceptionCount;
  final VoidCallback onReviewNotes;
  final ValueChanged<String> onPodComplete;
  final ValueChanged<String> onMarkFailed;
  final ValueChanged<String> onCaptureReturn;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(18),
      children: [
        _HeaderCard(
          title: 'Handoff',
          subtitle:
              'Proof, failure, and return actions for the driver at the door.',
          action: FilledButton(
            onPressed: onReviewNotes,
            child: const Text('Review notes'),
          ),
        ),
        const SizedBox(height: 14),
        _ProfileCard(
          title: 'Driver: Rahul',
          subtitle: 'Shift 6:00 AM - 2:00 PM',
          note:
              'Vehicle KA-01-AB-1234 | Ready stops: $readyCount | Exceptions: $exceptionCount',
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: const [
            _ActionGuideCard(
              icon: Icons.verified_outlined,
              title: 'POD complete',
              body: 'Capture photo or signature before you close the stop.',
            ),
            _ActionGuideCard(
              icon: Icons.report_outlined,
              title: 'Mark failed',
              body:
                  'Use this when the customer is unavailable or the handoff cannot happen.',
            ),
            _ActionGuideCard(
              icon: Icons.undo_rounded,
              title: 'Capture return',
              body: 'Record the return while the parcel is still traceable.',
            ),
          ],
        ),
        const SizedBox(height: 16),
        const _SectionTitle(
          title: 'Handoff checklist',
          subtitle:
              'The screen stays quick: one tap per action, one trace per stop.',
        ),
        const SizedBox(height: 12),
        ...tasks.map(
          (task) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: _TaskChecklistCard(
              task: task,
              onPodComplete: () => onPodComplete(task.orderId),
              onMarkFailed: () => onMarkFailed(task.orderId),
              onCaptureReturn: () => onCaptureReturn(task.orderId),
            ),
          ),
        ),
      ],
    );
  }
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({
    required this.title,
    required this.subtitle,
    required this.action,
  });

  final String title;
  final String subtitle;
  final Widget action;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AedenPalette.espresso, AedenPalette.chestnut],
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1F0F172A),
            blurRadius: 30,
            offset: Offset(0, 16),
          ),
        ],
      ),
      child: Row(
        children: [
          const CircleAvatar(
            radius: 24,
            backgroundColor: AedenPalette.goldBright,
            child: Icon(Icons.local_shipping_outlined, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(color: Colors.white),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(color: Color(0xFFCBD5E1)),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 140),
            child: action,
          ),
        ],
      ),
    );
  }
}

class _ManifestCard extends StatelessWidget {
  const _ManifestCard({
    required this.status,
    required this.note,
    required this.routeCount,
    required this.serverQueue,
    required this.localQueue,
  });

  final String status;
  final String note;
  final int routeCount;
  final int serverQueue;
  final int localQueue;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: AedenPalette.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Manifest $status',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
              _Pill(label: '$routeCount routes', tone: AedenPalette.gold),
            ],
          ),
          const SizedBox(height: 8),
          Text(note, style: const TextStyle(color: AedenPalette.grey, height: 1.4)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Pill(label: '$serverQueue server queued', tone: AedenPalette.red),
              _Pill(label: '$localQueue local queued', tone: AedenPalette.goldBright),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  const _HeroCard({
    required this.tasks,
    required this.readyCount,
    required this.routeCount,
    required this.exceptionCount,
  });

  final List<_DeliveryTask> tasks;
  final int readyCount;
  final int routeCount;
  final int exceptionCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AedenPalette.espresso, AedenPalette.chestnut],
        ),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Move every drop from dock to door with clarity.',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 8),
          const Text(
            'Route, proof of delivery, and exceptions stay visible in one place.',
            style: TextStyle(color: Color(0xFFCBD5E1), height: 1.5),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _Pill(label: '${tasks.length} stops', tone: AedenPalette.goldBright),
              _Pill(label: '$readyCount ready', tone: AedenPalette.green),
              _Pill(label: '$routeCount in flight', tone: AedenPalette.gold),
              _Pill(
                label: '$exceptionCount exceptions',
                tone: AedenPalette.red,
              ),
            ],
          ),
          const SizedBox(height: 14),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: tasks.isEmpty
                  ? 0.0
                  : (readyCount + routeCount) / tasks.length,
              minHeight: 10,
              backgroundColor: AedenPalette.goldSoft,
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.tone,
  });

  final String label;
  final String value;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AedenPalette.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: tone,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
          Text(value, style: Theme.of(context).textTheme.headlineSmall),
        ],
      ),
    );
  }
}

class _StopCard extends StatelessWidget {
  const _StopCard({
    required this.task,
    required this.onPodComplete,
    required this.onMarkFailed,
    required this.onCaptureReturn,
  });

  final _DeliveryTask task;
  final VoidCallback onPodComplete;
  final VoidCallback onMarkFailed;
  final VoidCallback onCaptureReturn;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AedenPalette.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: task.accent.withValues(alpha: 0.14),
                child: Text(
                  '${task.stopNumber}',
                  style: TextStyle(
                    color: task.accent,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task.customer,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    Text(
                      '${task.orderId} | ${task.address}',
                      style: const TextStyle(color: AedenPalette.grey),
                    ),
                  ],
                ),
              ),
              _Pill(label: task.status, tone: task.accent),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            task.note,
            style: const TextStyle(color: AedenPalette.grey, height: 1.35),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.tonal(
                  onPressed: onPodComplete,
                  child: const Text('POD'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  onPressed: onMarkFailed,
                  child: const Text('Fail'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextButton(
                  onPressed: onCaptureReturn,
                  child: const Text('Return'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _QueuePreviewCard extends StatelessWidget {
  const _QueuePreviewCard({required this.tasks});

  final List<_DeliveryTask> tasks;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AedenPalette.line),
        boxShadow: const [
          BoxShadow(
            color: Color(0x100F172A),
            blurRadius: 18,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: tasks
            .map(
              (task) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _QueueRow(task: task),
              ),
            )
            .toList(growable: false),
      ),
    );
  }
}

class _QueueRow extends StatelessWidget {
  const _QueueRow({required this.task});

  final _DeliveryTask task;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: task.status == 'Exception'
            ? AedenPalette.redSoft
            : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AedenPalette.line),
      ),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: task.accent.withValues(alpha: 0.16),
            child: Text(
              '${task.stopNumber}',
              style: TextStyle(color: task.accent, fontWeight: FontWeight.w900),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  task.customer,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Text(
                  task.orderId,
                  style: const TextStyle(color: AedenPalette.grey),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                task.status,
                style: TextStyle(
                  color: task.accent,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Text(
                task.slot,
                style: const TextStyle(color: AedenPalette.muted, fontSize: 12),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _MapCard extends StatelessWidget {
  const _MapCard({required this.tasks});

  final List<_DeliveryTask> tasks;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F1F49), Color(0xFF102A5C)],
        ),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Route board',
            style: TextStyle(
              color: Color(0xFFCBD5E1),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 14),
          ...tasks.map(
            (task) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _RouteRow(task: task),
            ),
          ),
        ],
      ),
    );
  }
}

class _RouteRow extends StatelessWidget {
  const _RouteRow({required this.task});

  final _DeliveryTask task;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: task.accent,
            child: Text(
              '${task.stopNumber}',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              '${task.customer} | ${task.address}',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Text(task.slot, style: const TextStyle(color: Color(0xFFCBD5E1))),
        ],
      ),
    );
  }
}

class _ActionGuideCard extends StatelessWidget {
  const _ActionGuideCard({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 160,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: AedenPalette.line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: AedenPalette.goldSoft,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: AedenPalette.gold),
            ),
            const SizedBox(height: 12),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 4),
            Text(
              body,
              style: const TextStyle(color: AedenPalette.grey, height: 1.35),
            ),
          ],
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.tone});

  final String label;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: tone.withValues(alpha: 0.2)),
      ),
      child: Text(
        label,
        style: TextStyle(color: tone, fontWeight: FontWeight.w800),
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
        Text(title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 4),
        Text(subtitle, style: const TextStyle(color: AedenPalette.grey)),
      ],
    );
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({
    required this.title,
    required this.subtitle,
    required this.note,
  });

  final String title;
  final String subtitle;
  final String note;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AedenPalette.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          Text(subtitle, style: const TextStyle(color: AedenPalette.grey)),
          const SizedBox(height: 6),
          Text(
            note,
            style: const TextStyle(color: AedenPalette.grey, height: 1.35),
          ),
        ],
      ),
    );
  }
}

class _TaskChecklistCard extends StatelessWidget {
  const _TaskChecklistCard({
    required this.task,
    required this.onPodComplete,
    required this.onMarkFailed,
    required this.onCaptureReturn,
  });

  final _DeliveryTask task;
  final VoidCallback onPodComplete;
  final VoidCallback onMarkFailed;
  final VoidCallback onCaptureReturn;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AedenPalette.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: task.accent.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Center(
                  child: Text(
                    '${task.stopNumber}',
                    style: TextStyle(
                      color: task.accent,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task.customer,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${task.orderId} | ${task.slot}',
                      style: const TextStyle(color: AedenPalette.grey),
                    ),
                  ],
                ),
              ),
              _Pill(label: task.status, tone: task.accent),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              FilledButton.tonal(
                onPressed: onPodComplete,
                child: const Text('POD complete'),
              ),
              OutlinedButton(
                onPressed: onMarkFailed,
                child: const Text('Mark failed'),
              ),
              TextButton(onPressed: onCaptureReturn, child: const Text('Capture return')),
            ],
          ),
        ],
      ),
    );
  }
}

enum DeliveryActionKind { pod, failure, returnCapture }

class _QueuedDeliveryAction {
  const _QueuedDeliveryAction({
    required this.eventId,
    required this.orderId,
    required this.slotId,
    required this.action,
    required this.note,
    required this.capturedAt,
    required this.statusLabel,
    required this.accent,
    this.signatureName,
    this.photoUrl,
    this.reasonCode,
    this.returnQuantity,
  });

  final String eventId;
  final String orderId;
  final String slotId;
  final String action;
  final String note;
  final String capturedAt;
  final String statusLabel;
  final Color accent;
  final String? signatureName;
  final String? photoUrl;
  final String? reasonCode;
  final int? returnQuantity;

  String get label {
    switch (action) {
      case 'pod_completed':
        return 'POD';
      case 'delivery_failed':
        return 'Failure';
      case 'return_captured':
        return 'Return';
      default:
        return action;
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'eventId': eventId,
      'orderId': orderId,
      'slotId': slotId,
      'action': action,
      'note': note,
      'capturedAt': capturedAt,
      if (signatureName != null && signatureName!.isNotEmpty) 'signatureName': signatureName,
      if (photoUrl != null && photoUrl!.isNotEmpty) 'photoUrl': photoUrl,
      if (reasonCode != null && reasonCode!.isNotEmpty) 'reasonCode': reasonCode,
      if (returnQuantity != null) 'returnQuantity': returnQuantity,
    };
  }
}

class _DeliveryTask {
  const _DeliveryTask({
    required this.stopNumber,
    required this.slotId,
    required this.orderId,
    required this.customer,
    required this.address,
    required this.slot,
    required this.status,
    required this.accent,
    required this.note,
  });

  final int stopNumber;
  final String slotId;
  final String orderId;
  final String customer;
  final String address;
  final String slot;
  final String status;
  final Color accent;
  final String note;

  _DeliveryTask copyWith({
    String? status,
    Color? accent,
  }) {
    return _DeliveryTask(
      stopNumber: stopNumber,
      slotId: slotId,
      orderId: orderId,
      customer: customer,
      address: address,
      slot: slot,
      status: status ?? this.status,
      accent: accent ?? this.accent,
      note: note,
    );
  }
}
