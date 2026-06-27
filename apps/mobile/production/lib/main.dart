import 'dart:convert';

import 'package:aeden_brand/aeden_brand.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const BakeryProductionApp());
}

const String _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://127.0.0.1:4000',
);
const String _productionUsername = String.fromEnvironment(
  'PRODUCTION_USERNAME',
  defaultValue: 'production',
);
const String _productionPassword = String.fromEnvironment(
  'PRODUCTION_PASSWORD',
  defaultValue: 'production123',
);

const Color _ink = AedenPalette.ink;
const Color _inkSoft = AedenPalette.muted;
const Color _cream = AedenPalette.cream;
const Color _creamSurface = AedenPalette.ivory;
const Color _gold = AedenPalette.gold;
const Color _goldSoft = AedenPalette.goldSoft;
const Color _blue = AedenPalette.goldBright;
const Color _blueSoft = AedenPalette.goldSoft;
const Color _alert = AedenPalette.red;
const Color _success = AedenPalette.green;

ThemeData _buildProductionTheme() {
  final brandTheme = buildAedenBrandTheme(brightness: Brightness.light);

  return brandTheme.copyWith(
    scaffoldBackgroundColor: _cream,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      foregroundColor: _ink,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: _gold,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        textStyle: const TextStyle(
          fontWeight: FontWeight.w800,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: _ink,
        side: const BorderSide(color: AedenPalette.line),
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        textStyle: const TextStyle(
          fontWeight: FontWeight.w800,
        ),
      ),
    ),
  );
}

class BakeryProductionApp extends StatelessWidget {
  const BakeryProductionApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Aeden Bakes Production',
      theme: _buildProductionTheme(),
      home: const ProductionHome(),
    );
  }
}

class ProductionHome extends StatefulWidget {
  const ProductionHome({super.key});

  @override
  State<ProductionHome> createState() => _ProductionHomeState();
}

class _ProductionHomeState extends State<ProductionHome> {
  String? _token;
  bool _loading = true;
  String? _error;
  _ProductionSnapshot? _snapshot;
  String? _actionMessage;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
      _snapshot = null;
      _actionMessage = null;
    });

    try {
      final loginResponse = await http.post(
        Uri.parse('$_apiBaseUrl/auth/login'),
        headers: const {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': _productionUsername,
          'password': _productionPassword,
        }),
      );

      if (loginResponse.statusCode < 200 || loginResponse.statusCode >= 300) {
        throw Exception(
          'Production login failed with status ${loginResponse.statusCode}',
        );
      }

      final loginJson = jsonDecode(loginResponse.body) as Map<String, dynamic>;
      _token = loginJson['token'] as String?;
      await _refreshSnapshot();
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
      throw Exception('Missing production session token');
    }

    final responses = await Future.wait([
      http.get(
        Uri.parse('$_apiBaseUrl/production/batches'),
        headers: _authHeaders(token),
      ),
      http.get(Uri.parse('$_apiBaseUrl/catalog'), headers: _authHeaders(token)),
      http.get(Uri.parse('$_apiBaseUrl/orders'), headers: _authHeaders(token)),
    ]);

    for (final response in responses) {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('API returned ${response.statusCode}');
      }
    }

    final batchJson = jsonDecode(responses[0].body) as Map<String, dynamic>;
    final catalogJson = jsonDecode(responses[1].body) as Map<String, dynamic>;
    final ordersJson = jsonDecode(responses[2].body) as Map<String, dynamic>;

    _snapshot = _ProductionSnapshot.fromJson(
      batchJson,
      catalogJson: catalogJson,
      ordersJson: ordersJson,
    );

    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _refreshSnapshotSafely() async {
    try {
      await _refreshSnapshot();
      if (mounted) {
        setState(() {
          _error = null;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
        });
      }
    }
  }

  Future<void> _changeBatchStatus(String action, String successMessage) async {
    final token = _token;
    final snapshot = _snapshot;
    if (token == null || snapshot == null) {
      return;
    }

    try {
      final response = await http.post(
        Uri.parse(
          '$_apiBaseUrl/production/batches/${snapshot.batch.id}/$action',
        ),
        headers: _authHeaders(token),
      );

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception(_extractErrorMessage(response, 'Batch update failed'));
      }

      await _refreshSnapshot();
      if (mounted) {
        setState(() {
          _actionMessage = successMessage;
          _error = null;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
        });
      }
    }
  }

  Map<String, String> _authHeaders(String token) => {
    'Authorization': 'Bearer $token',
  };

  String _extractErrorMessage(http.Response response, String fallback) {
    try {
      final payload = jsonDecode(response.body) as Map<String, dynamic>;
      return payload['error'] as String? ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const _LoadingScreen(message: 'Signing into production...');
    }

    if (_error != null && _snapshot == null) {
      return _ErrorState(
        message: 'Could not load the live production sheet.',
        details: _error!,
        onRetry: _bootstrap,
      );
    }

    final snapshot = _snapshot;
    if (snapshot == null) {
      return const _ErrorState(
        message: 'Production data was empty.',
        details: 'The API responded without batches or catalog data.',
      );
    }

    final bannerText = _error ?? _actionMessage;
    final bannerTone = _error != null ? _BannerTone.bad : _BannerTone.good;

    return DefaultTabController(
      length: 4,
      child: Scaffold(
        body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [
              AedenPalette.espresso,
              AedenPalette.chestnut,
              AedenPalette.cream,
              AedenPalette.ivory,
              ],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              stops: [0.0, 0.34, 0.66, 1.0],
            ),
          ),
          child: SafeArea(
            bottom: false,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  child: _ProductionHeader(snapshot: snapshot),
                ),
                if (bannerText != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                    child: _FeedbackBanner(text: bannerText, tone: bannerTone),
                  ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: _SectionTabBar(batchStatus: snapshot.batch.status),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: RefreshIndicator(
                    onRefresh: _refreshSnapshotSafely,
                    color: _gold,
                    backgroundColor: _creamSurface,
                    child: TabBarView(
                      children: [
                        _TodayTab(
                          snapshot: snapshot,
                          onLock: () =>
                              _changeBatchStatus('lock', 'Batch locked.'),
                          onStart: () =>
                              _changeBatchStatus('start', 'Batch started.'),
                          onComplete: () => _changeBatchStatus(
                            'complete',
                            'Batch completed.',
                          ),
                          onUnlock: () =>
                              _changeBatchStatus('unlock', 'Batch unlocked.'),
                        ),
                        _StationsTab(snapshot: snapshot),
                        _PackingTab(snapshot: snapshot),
                        _ExceptionsTab(snapshot: snapshot),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProductionSnapshot {
  const _ProductionSnapshot({
    required this.batch,
    required this.confirmedUnits,
    required this.actualUnits,
    required this.shortageUnits,
    required this.lines,
    required this.stationGroups,
    required this.slotSummaries,
  });

  final _ProductionBatch batch;
  final int confirmedUnits;
  final int actualUnits;
  final int shortageUnits;
  final List<_ProductionLine> lines;
  final List<_StationSummary> stationGroups;
  final List<_SlotSummary> slotSummaries;

  int get lineCount => lines.length;

  int get shortLineCount =>
      lines.where((line) => line.shortQuantity > 0).length;

  int get fulfillmentPercent =>
      confirmedUnits == 0 ? 0 : ((actualUnits / confirmedUnits) * 100).round();

  bool get canLock => batch.status == 'draft';

  bool get canStart => batch.status == 'locked';

  bool get canComplete => batch.status == 'in_progress';

  bool get canUnlock => batch.status == 'locked';

  factory _ProductionSnapshot.fromJson(
    Map<String, dynamic> batchJson, {
    required Map<String, dynamic> catalogJson,
    required Map<String, dynamic> ordersJson,
  }) {
    final batchList =
        (batchJson['productionBatches'] as List<dynamic>? ?? const [])
            .map(
              (entry) =>
                  _ProductionBatch.fromJson(entry as Map<String, dynamic>),
            )
            .toList(growable: false);
    final batch = batchList.isNotEmpty
        ? batchList.first
        : const _ProductionBatch(
            id: 'none',
            serviceDate: 'unknown',
            status: 'draft',
            lines: [],
          );

    final productById = <String, _Product>{};
    for (final entry
        in (catalogJson['products'] as List<dynamic>? ?? const [])) {
      final productJson = entry as Map<String, dynamic>;
      final id = productJson['id'] as String? ?? '';
      if (id.isEmpty) {
        continue;
      }
      productById[id] = _Product.fromJson(productJson);
    }

    final demandHints = <String, int>{};
    for (final orderEntry
        in (ordersJson['orders'] as List<dynamic>? ?? const [])) {
      final orderJson = orderEntry as Map<String, dynamic>;
      final slotId = orderJson['slotId'] as String? ?? '';
      demandHints[slotId] = (demandHints[slotId] ?? 0) + 1;
    }

    final lines =
        batch.lines
            .map((line) {
              final product = productById[line.productId];
              final plannedQuantity = line.plannedQuantity;
              final actualQuantity = line.actualQuantity;
              final shortage = line.shortQuantity;
              return _ProductionLine(
                productName: product?.name ?? line.productId,
                productCategory: product?.category ?? 'Unknown',
                slotId: line.slotId,
                plannedQuantity: plannedQuantity,
                actualQuantity: actualQuantity,
                shortQuantity: shortage,
                note: line.note,
              );
            })
            .toList(growable: false)
          ..sort((left, right) {
            final slotCompare = left.slotId.compareTo(right.slotId);
            if (slotCompare != 0) {
              return slotCompare;
            }
            final stationCompare = left.stationName.compareTo(
              right.stationName,
            );
            if (stationCompare != 0) {
              return stationCompare;
            }
            return left.productName.compareTo(right.productName);
          });

    final confirmedUnits = lines.fold<int>(
      0,
      (sum, line) => sum + line.plannedQuantity,
    );
    final actualUnits = lines.fold<int>(
      0,
      (sum, line) => sum + line.actualQuantity,
    );
    final shortageUnits = lines.fold<int>(
      0,
      (sum, line) => sum + line.shortQuantity,
    );

    return _ProductionSnapshot(
      batch: batch,
      confirmedUnits: confirmedUnits,
      actualUnits: actualUnits,
      shortageUnits: shortageUnits,
      lines: lines,
      stationGroups: _StationSummary.fromLines(lines),
      slotSummaries: _SlotSummary.fromLines(lines, demandHints),
    );
  }
}

class _ProductionBatch {
  const _ProductionBatch({
    required this.id,
    required this.serviceDate,
    required this.status,
    required this.lines,
  });

  final String id;
  final String serviceDate;
  final String status;
  final List<_BatchLine> lines;

  factory _ProductionBatch.fromJson(Map<String, dynamic> json) {
    return _ProductionBatch(
      id: json['id'] as String? ?? 'batch',
      serviceDate: json['serviceDate'] as String? ?? 'unknown',
      status: json['status'] as String? ?? 'draft',
      lines: (json['lines'] as List<dynamic>? ?? const [])
          .map((entry) => _BatchLine.fromJson(entry as Map<String, dynamic>))
          .toList(growable: false),
    );
  }
}

class _BatchLine {
  const _BatchLine({
    required this.productId,
    required this.slotId,
    required this.quantity,
    required this.plannedQuantity,
    required this.actualQuantity,
    required this.shortQuantity,
    required this.note,
  });

  final String productId;
  final String slotId;
  final int quantity;
  final int plannedQuantity;
  final int actualQuantity;
  final int shortQuantity;
  final String note;

  factory _BatchLine.fromJson(Map<String, dynamic> json) {
    return _BatchLine(
      productId: json['productId'] as String? ?? '',
      slotId: json['slotId'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      plannedQuantity:
          (json['plannedQuantity'] as num?)?.toInt() ??
          (json['quantity'] as num?)?.toInt() ??
          0,
      actualQuantity:
          (json['actualQuantity'] as num?)?.toInt() ??
          (json['quantity'] as num?)?.toInt() ??
          0,
      shortQuantity: (json['shortQuantity'] as num?)?.toInt() ?? 0,
      note: json['note'] as String? ?? '',
    );
  }
}

class _Product {
  const _Product({required this.name, required this.category});

  final String name;
  final String category;

  factory _Product.fromJson(Map<String, dynamic> json) {
    return _Product(
      name: json['name'] as String? ?? 'Unknown product',
      category: json['category'] as String? ?? 'Uncategorized',
    );
  }
}

class _ProductionLine {
  const _ProductionLine({
    required this.productName,
    required this.productCategory,
    required this.slotId,
    required this.plannedQuantity,
    required this.actualQuantity,
    required this.shortQuantity,
    required this.note,
  });

  final String productName;
  final String productCategory;
  final String slotId;
  final int plannedQuantity;
  final int actualQuantity;
  final int shortQuantity;
  final String note;

  String get statusLabel {
    if (shortQuantity <= 0) {
      return 'Ready';
    }
    if (shortQuantity <= 5) {
      return 'Watch';
    }
    return 'Shortage';
  }

  String get stationName {
    switch (productCategory.toLowerCase()) {
      case 'bread':
        return 'Bake line';
      case 'laminated':
        return 'Lamination';
      case 'pastry':
        return 'Finishing';
      case 'cakes':
        return 'Finishing';
      default:
        return 'Support station';
    }
  }

  String get stationHint {
    switch (productCategory.toLowerCase()) {
      case 'bread':
        return 'Bulk dough, oven timing, and loaf counts.';
      case 'laminated':
        return 'Butter lamination, proofing, and tray spacing.';
      case 'pastry':
        return 'Fill, glaze, and final cosmetic checks.';
      case 'cakes':
        return 'Layering, frosting, and dispatch finishing.';
      default:
        return 'Support tasks and ad hoc handoff work.';
    }
  }

  String get slotLabel => _prettySlotLabel(slotId);

  double get completionRatio => plannedQuantity == 0
      ? 0
      : (actualQuantity / plannedQuantity).clamp(0.0, 1.0);
}

class _StationSummary {
  const _StationSummary({
    required this.name,
    required this.description,
    required this.lines,
    required this.plannedUnits,
    required this.actualUnits,
    required this.shortageUnits,
  });

  final String name;
  final String description;
  final List<_ProductionLine> lines;
  final int plannedUnits;
  final int actualUnits;
  final int shortageUnits;

  String get statusLabel {
    if (shortageUnits == 0) {
      return 'Balanced';
    }
    if (shortageUnits <= 5) {
      return 'Watch';
    }
    return 'Short';
  }

  static List<_StationSummary> fromLines(List<_ProductionLine> lines) {
    final groups = <String, List<_ProductionLine>>{};
    for (final line in lines) {
      groups.putIfAbsent(line.stationName, () => []).add(line);
    }

    final summaries =
        groups.entries
            .map((entry) {
              final groupLines = entry.value;
              return _StationSummary(
                name: entry.key,
                description: groupLines.first.stationHint,
                lines: groupLines,
                plannedUnits: groupLines.fold<int>(
                  0,
                  (sum, line) => sum + line.plannedQuantity,
                ),
                actualUnits: groupLines.fold<int>(
                  0,
                  (sum, line) => sum + line.actualQuantity,
                ),
                shortageUnits: groupLines.fold<int>(
                  0,
                  (sum, line) => sum + line.shortQuantity,
                ),
              );
            })
            .toList(growable: false)
          ..sort((left, right) {
            final shortageCompare = right.shortageUnits.compareTo(
              left.shortageUnits,
            );
            if (shortageCompare != 0) {
              return shortageCompare;
            }
            return left.name.compareTo(right.name);
          });

    return summaries;
  }
}

class _SlotSummary {
  const _SlotSummary({
    required this.slotId,
    required this.lineCount,
    required this.plannedUnits,
    required this.actualUnits,
    required this.shortageUnits,
    required this.demandHint,
  });

  final String slotId;
  final int lineCount;
  final int plannedUnits;
  final int actualUnits;
  final int shortageUnits;
  final int demandHint;

  String get label => _prettySlotLabel(slotId);

  String get statusLabel {
    if (shortageUnits == 0) {
      return 'Clear';
    }
    if (shortageUnits <= 5) {
      return 'Tight';
    }
    return 'Risk';
  }

  static List<_SlotSummary> fromLines(
    List<_ProductionLine> lines,
    Map<String, int> demandHints,
  ) {
    final groups = <String, List<_ProductionLine>>{};
    for (final line in lines) {
      groups.putIfAbsent(line.slotId, () => []).add(line);
    }

    final summaries =
        groups.entries
            .map((entry) {
              final groupLines = entry.value;
              return _SlotSummary(
                slotId: entry.key,
                lineCount: groupLines.length,
                plannedUnits: groupLines.fold<int>(
                  0,
                  (sum, line) => sum + line.plannedQuantity,
                ),
                actualUnits: groupLines.fold<int>(
                  0,
                  (sum, line) => sum + line.actualQuantity,
                ),
                shortageUnits: groupLines.fold<int>(
                  0,
                  (sum, line) => sum + line.shortQuantity,
                ),
                demandHint: demandHints[entry.key] ?? 0,
              );
            })
            .toList(growable: false)
          ..sort((left, right) => left.slotId.compareTo(right.slotId));

    return summaries;
  }
}

class _ProductionHeader extends StatelessWidget {
  const _ProductionHeader({required this.snapshot});

  final _ProductionSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AedenPalette.espresso, AedenPalette.chestnut, AedenPalette.goldBright],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(32),
        boxShadow: const [
          BoxShadow(
            color: Color(0x30000000),
            blurRadius: 30,
            offset: Offset(0, 16),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                height: 42,
                width: 42,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.12),
                  ),
                ),
                child: const Icon(
                  Icons.kitchen_outlined,
                  color: Colors.white,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Aeden Bakes / Production',
                      style: Theme.of(context).textTheme.labelLarge?.copyWith(
                        color: const Color(0xFFF0D7AB),
                        letterSpacing: 0.18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Batch ${snapshot.batch.id}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.72),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              _ChipPill(
                label: _prettyBatchStatus(snapshot.batch.status),
                backgroundColor: _batchStatusColor(
                  snapshot.batch.status,
                ).withValues(alpha: 0.2),
                foregroundColor: _batchStatusColor(snapshot.batch.status),
                borderColor: _batchStatusColor(
                  snapshot.batch.status,
                ).withValues(alpha: 0.28),
                icon: Icons.bolt_outlined,
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            'Production cockpit',
            style: Theme.of(context).textTheme.displaySmall?.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.8,
              height: 1.0,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            'Batch runs, station tasks, packing, exceptions, and fulfillment control stay in one floor-first view.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.76),
              height: 1.5,
            ),
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _ChipPill(
                label: snapshot.batch.serviceDate,
                backgroundColor: Colors.white.withValues(alpha: 0.08),
                foregroundColor: Colors.white,
                borderColor: Colors.white.withValues(alpha: 0.12),
                icon: Icons.calendar_today_outlined,
              ),
              _ChipPill(
                label: '${snapshot.lineCount} lines',
                backgroundColor: Colors.white.withValues(alpha: 0.08),
                foregroundColor: Colors.white,
                borderColor: Colors.white.withValues(alpha: 0.12),
                icon: Icons.view_list_outlined,
              ),
              _ChipPill(
                label: '${snapshot.stationGroups.length} stations',
                backgroundColor: Colors.white.withValues(alpha: 0.08),
                foregroundColor: Colors.white,
                borderColor: Colors.white.withValues(alpha: 0.12),
                icon: Icons.route_outlined,
              ),
              _ChipPill(
                label: '${snapshot.shortLineCount} alerts',
                backgroundColor: Colors.white.withValues(alpha: 0.08),
                foregroundColor: Colors.white,
                borderColor: Colors.white.withValues(alpha: 0.12),
                icon: Icons.report_gmailerrorred_outlined,
              ),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: _MetricTile(
                  label: 'Planned units',
                  value: _formatNumber(snapshot.confirmedUnits),
                  accentColor: _goldSoft,
                  dark: true,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _MetricTile(
                  label: 'Verified units',
                  value: _formatNumber(snapshot.actualUnits),
                  accentColor: _blueSoft,
                  dark: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _MetricTile(
                  label: 'Shortage',
                  value: _formatNumber(snapshot.shortageUnits),
                  accentColor: snapshot.shortageUnits > 0
                      ? const Color(0xFFF1B0A0)
                      : const Color(0xFF97D4B7),
                  dark: true,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _MetricTile(
                  label: 'Stations',
                  value: snapshot.stationGroups.length.toString(),
                  accentColor: const Color(0xFFF3DDBE),
                  dark: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: snapshot.fulfillmentPercent / 100,
              minHeight: 10,
              backgroundColor: Colors.white.withValues(alpha: 0.12),
              valueColor: const AlwaysStoppedAnimation<Color>(_gold),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            '${snapshot.fulfillmentPercent}% ready for the floor',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Colors.white.withValues(alpha: 0.7),
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTabBar extends StatelessWidget {
  const _SectionTabBar({required this.batchStatus});

  final String batchStatus;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: const Color(0x1F17120E)),
      ),
      child: TabBar(
        dividerColor: Colors.transparent,
        labelColor: Colors.white,
        unselectedLabelColor: const Color(0xFF6A5D52),
        labelStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
        unselectedLabelStyle: const TextStyle(
          fontWeight: FontWeight.w700,
          fontSize: 13,
        ),
        indicator: BoxDecoration(
          color: _blue,
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [
            BoxShadow(
              color: Color(0x22000000),
              blurRadius: 18,
              offset: Offset(0, 10),
            ),
          ],
        ),
        indicatorSize: TabBarIndicatorSize.tab,
        splashBorderRadius: BorderRadius.circular(16),
        tabs: [
          Tab(
            icon: Icon(
              Icons.view_day_outlined,
              color: _tabIconColor(batchStatus, 'Today'),
              size: 18,
            ),
            text: 'Today',
          ),
          Tab(
            icon: Icon(
              Icons.precision_manufacturing_outlined,
              color: _tabIconColor(batchStatus, 'Stations'),
              size: 18,
            ),
            text: 'Stations',
          ),
          Tab(
            icon: Icon(
              Icons.inventory_2_outlined,
              color: _tabIconColor(batchStatus, 'Packing'),
              size: 18,
            ),
            text: 'Packing',
          ),
          Tab(
            icon: Icon(
              Icons.report_problem_outlined,
              color: _tabIconColor(batchStatus, 'Exceptions'),
              size: 18,
            ),
            text: 'Exceptions',
          ),
        ],
      ),
    );
  }
}

class _TodayTab extends StatelessWidget {
  const _TodayTab({
    required this.snapshot,
    required this.onLock,
    required this.onStart,
    required this.onComplete,
    required this.onUnlock,
  });

  final _ProductionSnapshot snapshot;
  final VoidCallback onLock;
  final VoidCallback onStart;
  final VoidCallback onComplete;
  final VoidCallback onUnlock;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      children: [
        _BatchControlCard(
          snapshot: snapshot,
          onLock: onLock,
          onStart: onStart,
          onComplete: onComplete,
          onUnlock: onUnlock,
        ),
        const SizedBox(height: 14),
        const SectionHeading(
          title: 'Run sheet',
          subtitle: 'Grouped by batch line for the production floor.',
        ),
        const SizedBox(height: 12),
        if (snapshot.lines.isEmpty)
          const _PremiumCard(
            child: _EmptyState(
              title: 'No batch lines yet',
              body:
                  'The batch sheet is empty, so the floor has no work to stage.',
            ),
          )
        else
          ...snapshot.lines.map(
            (line) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _LineCard(line: line),
            ),
          ),
        const SizedBox(height: 4),
        const _PremiumCard(
          child: _NoteBlock(
            title: 'Guardrail',
            body:
                'No manual quantity change below booked demand without an override reason.',
            icon: Icons.lock_outline,
          ),
        ),
      ],
    );
  }
}

class _StationsTab extends StatelessWidget {
  const _StationsTab({required this.snapshot});

  final _ProductionSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      children: [
        const SectionHeading(
          title: 'Station tasks',
          subtitle:
              'The line is grouped by workstation so the floor can move fast.',
        ),
        const SizedBox(height: 12),
        if (snapshot.stationGroups.isEmpty)
          const _PremiumCard(
            child: _EmptyState(
              title: 'No station groups',
              body: 'There are no production lines to assign to stations yet.',
            ),
          )
        else
          ...snapshot.stationGroups.map(
            (station) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _StationCard(station: station),
            ),
          ),
      ],
    );
  }
}

class _PackingTab extends StatelessWidget {
  const _PackingTab({required this.snapshot});

  final _ProductionSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      children: [
        const SectionHeading(
          title: 'Packing and dispatch',
          subtitle: 'Stage labels, crates, and pickup notes before release.',
        ),
        const SizedBox(height: 12),
        _PackingSummaryCard(snapshot: snapshot),
        const SizedBox(height: 12),
        _PackingChecklistCard(snapshot: snapshot),
        const SizedBox(height: 12),
        const SectionHeading(
          title: 'Slot staging',
          subtitle:
              'Packing is grouped by delivery slot to keep handoff clean.',
        ),
        const SizedBox(height: 12),
        if (snapshot.slotSummaries.isEmpty)
          const _PremiumCard(
            child: _EmptyState(
              title: 'No slot staging yet',
              body: 'There are no slots in this batch to stage for dispatch.',
            ),
          )
        else
          ...snapshot.slotSummaries.map(
            (slot) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _SlotCard(slot: slot),
            ),
          ),
      ],
    );
  }
}

class _ExceptionsTab extends StatelessWidget {
  const _ExceptionsTab({required this.snapshot});

  final _ProductionSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
      children: [
        const SectionHeading(
          title: 'Exceptions, returns, and release gate',
          subtitle: 'Keep shortages, rework, and fulfillment holds visible.',
        ),
        const SizedBox(height: 12),
        _ExceptionsSummaryCard(snapshot: snapshot),
        const SizedBox(height: 12),
        _ReturnsCard(snapshot: snapshot),
        const SizedBox(height: 12),
        _FulfillmentGateCard(snapshot: snapshot),
        const SizedBox(height: 12),
        const _PremiumCard(
          child: _NoteBlock(
            title: 'Rework note',
            body:
                'Returns are captured in the delivery workflow. Production only sees them when they need rework or a hold note.',
            icon: Icons.keyboard_return_outlined,
          ),
        ),
      ],
    );
  }
}

class _BatchControlCard extends StatelessWidget {
  const _BatchControlCard({
    required this.snapshot,
    required this.onLock,
    required this.onStart,
    required this.onComplete,
    required this.onUnlock,
  });

  final _ProductionSnapshot snapshot;
  final VoidCallback onLock;
  final VoidCallback onStart;
  final VoidCallback onComplete;
  final VoidCallback onUnlock;

  @override
  Widget build(BuildContext context) {
    return _PremiumCard(
      child: Column(
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
                      'Batch controls',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: _ink,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Lock, start, and complete the floor sheet with one audited flow.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: _inkSoft,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              _ChipPill(
                label: _prettyBatchStatus(snapshot.batch.status),
                backgroundColor: _batchStatusColor(
                  snapshot.batch.status,
                ).withValues(alpha: 0.12),
                foregroundColor: _batchStatusColor(snapshot.batch.status),
                borderColor: _batchStatusColor(
                  snapshot.batch.status,
                ).withValues(alpha: 0.22),
                icon: Icons.timelapse_outlined,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              FilledButton.icon(
                onPressed: snapshot.canLock ? onLock : null,
                icon: const Icon(Icons.lock_outline, size: 18),
                label: const Text('Lock sheet'),
              ),
              FilledButton.icon(
                onPressed: snapshot.canStart ? onStart : null,
                icon: const Icon(Icons.play_arrow_rounded, size: 18),
                label: const Text('Start run'),
              ),
              FilledButton.icon(
                onPressed: snapshot.canComplete ? onComplete : null,
                icon: const Icon(Icons.check_circle_outline, size: 18),
                label: const Text('Complete batch'),
              ),
              OutlinedButton.icon(
                onPressed: snapshot.canUnlock ? onUnlock : null,
                icon: const Icon(Icons.lock_open_outlined, size: 18),
                label: const Text('Unlock'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _LifecycleRail(status: snapshot.batch.status),
        ],
      ),
    );
  }
}

class _LifecycleRail extends StatelessWidget {
  const _LifecycleRail({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final currentIndex = _batchStageIndex(status);
    const stages = [
      _LifecycleStage(stage: 'draft', title: 'Draft', subtitle: 'Sheet'),
      _LifecycleStage(stage: 'locked', title: 'Locked', subtitle: 'Freeze'),
      _LifecycleStage(stage: 'in_progress', title: 'Running', subtitle: 'Bake'),
      _LifecycleStage(stage: 'completed', title: 'Done', subtitle: 'Release'),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Lifecycle',
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
            color: _inkSoft,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.18,
          ),
        ),
        const SizedBox(height: 10),
        Row(
          children: stages
              .asMap()
              .entries
              .map((entry) {
                final index = entry.key;
                final stage = entry.value;
                final isActive = index <= currentIndex;
                final isCurrent = index == currentIndex;
                final backgroundColor = isCurrent
                    ? _blue
                    : isActive
                    ? const Color(0xFFF6E7D8)
                    : const Color(0xFFF3E8D9);
                final foregroundColor = isCurrent ? Colors.white : _ink;

                return Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(
                      right: index == stages.length - 1 ? 0 : 8,
                    ),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        color: backgroundColor,
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(
                          color: isCurrent
                              ? _blue.withValues(alpha: 0.18)
                              : const Color(0x1B17120E),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            stage.title,
                            style: Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(
                                  color: foregroundColor,
                                  fontWeight: FontWeight.w900,
                                ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            stage.subtitle,
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: isCurrent
                                      ? Colors.white.withValues(alpha: 0.8)
                                      : _inkSoft,
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              })
              .toList(growable: false),
        ),
      ],
    );
  }
}

class _LifecycleStage {
  const _LifecycleStage({
    required this.stage,
    required this.title,
    required this.subtitle,
  });

  final String stage;
  final String title;
  final String subtitle;
}

class _LineCard extends StatelessWidget {
  const _LineCard({required this.line});

  final _ProductionLine line;

  @override
  Widget build(BuildContext context) {
    final tone = _lineTone(line);

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.white, tone.background.withValues(alpha: 0.2)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: tone.border.withValues(alpha: 0.35)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x12000000),
            blurRadius: 18,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
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
                        line.productName,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(
                              fontWeight: FontWeight.w900,
                              color: _ink,
                            ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${line.productCategory}  •  ${line.stationName}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: _inkSoft,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                _ChipPill(
                  label: line.statusLabel,
                  backgroundColor: tone.background,
                  foregroundColor: tone.foreground,
                  borderColor: tone.border,
                  icon: Icons.brightness_1,
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: _MetricTile(
                    label: 'Planned',
                    value: _formatNumber(line.plannedQuantity),
                    accentColor: _goldSoft,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _MetricTile(
                    label: 'Actual',
                    value: _formatNumber(line.actualQuantity),
                    accentColor: _blueSoft,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: _MetricTile(
                    label: 'Short',
                    value: _formatNumber(line.shortQuantity),
                    accentColor: line.shortQuantity > 0
                        ? const Color(0xFFF3B2A4)
                        : const Color(0xFFBFDCC8),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _MetricTile(
                    label: 'Slot',
                    value: line.slotLabel,
                    accentColor: const Color(0xFFE7E0D7),
                  ),
                ),
              ],
            ),
            if (line.note.isNotEmpty) ...[
              const SizedBox(height: 12),
              _NoteBlock(
                title: 'Floor note',
                body: line.note,
                icon: Icons.sticky_note_2_outlined,
                compact: true,
              ),
            ],
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(999),
              child: LinearProgressIndicator(
                value: line.completionRatio,
                minHeight: 8,
                backgroundColor: AedenPalette.goldSoft,
                valueColor: AlwaysStoppedAnimation<Color>(tone.foreground),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StationCard extends StatelessWidget {
  const _StationCard({required this.station});

  final _StationSummary station;

  @override
  Widget build(BuildContext context) {
    final tone = _stationTone(station);

    return _PremiumCard(
      child: Column(
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
                      station.name,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: _ink,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      station.description,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: _inkSoft,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              _ChipPill(
                label: station.statusLabel,
                backgroundColor: tone.background,
                foregroundColor: tone.foreground,
                borderColor: tone.border,
                icon: Icons.precision_manufacturing_outlined,
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _MetricTile(
                  label: 'Planned',
                  value: _formatNumber(station.plannedUnits),
                  accentColor: _goldSoft,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MetricTile(
                  label: 'Actual',
                  value: _formatNumber(station.actualUnits),
                  accentColor: _blueSoft,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MetricTile(
                  label: 'Short',
                  value: _formatNumber(station.shortageUnits),
                  accentColor: station.shortageUnits > 0
                      ? const Color(0xFFF3B2A4)
                      : const Color(0xFFBFDCC8),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ...station.lines.map(
            (line) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _CompactLineRow(line: line),
            ),
          ),
        ],
      ),
    );
  }
}

class _CompactLineRow extends StatelessWidget {
  const _CompactLineRow({required this.line});

  final _ProductionLine line;

  @override
  Widget build(BuildContext context) {
    final tone = _lineTone(line);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: tone.border.withValues(alpha: 0.22)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  line.productName,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: _ink,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${line.slotLabel}  •  ${line.productCategory}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: _inkSoft,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            '${_formatNumber(line.plannedQuantity)} / ${_formatNumber(line.actualQuantity)}',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              color: _ink,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _PackingSummaryCard extends StatelessWidget {
  const _PackingSummaryCard({required this.snapshot});

  final _ProductionSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return _PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Packing summary',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
              color: _ink,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Keep crates, labels, and dispatch notes aligned with the batch sheet.',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: _inkSoft, height: 1.45),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _MetricTile(
                  label: 'Packed units',
                  value: _formatNumber(snapshot.actualUnits),
                  accentColor: _blueSoft,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MetricTile(
                  label: 'Hold units',
                  value: _formatNumber(snapshot.shortageUnits),
                  accentColor: snapshot.shortageUnits > 0
                      ? const Color(0xFFF3B2A4)
                      : const Color(0xFFBFDCC8),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _MetricTile(
                  label: 'Slots',
                  value: snapshot.slotSummaries.length.toString(),
                  accentColor: _goldSoft,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MetricTile(
                  label: 'Ready',
                  value: '${snapshot.fulfillmentPercent}%',
                  accentColor: const Color(0xFFE8E0D8),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PackingChecklistCard extends StatelessWidget {
  const _PackingChecklistCard({required this.snapshot});

  final _ProductionSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final checklist = <_ChecklistItem>[
      _ChecklistItem(
        label: 'Print batch labels',
        detail: 'The sheet is ready for line labels and crate tags.',
        done: snapshot.batch.status != 'draft',
      ),
      _ChecklistItem(
        label: 'Stage by slot',
        detail: 'Separate packing into the route and dispatch lanes.',
        done:
            snapshot.batch.status == 'locked' ||
            snapshot.batch.status == 'in_progress' ||
            snapshot.batch.status == 'completed',
      ),
      _ChecklistItem(
        label: 'Separate exceptions',
        detail: 'Keep shortage or rework items in a visible hold tray.',
        done: snapshot.shortageUnits == 0,
      ),
      _ChecklistItem(
        label: 'Release for fulfillment',
        detail: 'Complete the batch only after counts are signed off.',
        done: snapshot.batch.status == 'completed',
      ),
    ];

    return _PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Packing checklist',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
              color: _ink,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'A quick floor checklist keeps handoff tight and avoids rework.',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: _inkSoft, height: 1.45),
          ),
          const SizedBox(height: 14),
          ...checklist.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _ChecklistRow(item: item),
            ),
          ),
        ],
      ),
    );
  }
}

class _SlotCard extends StatelessWidget {
  const _SlotCard({required this.slot});

  final _SlotSummary slot;

  @override
  Widget build(BuildContext context) {
    final tone = _slotTone(slot);

    return _PremiumCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        slot.label,
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w900,
                          color: _ink,
                        ),
                      ),
                    ),
                    _ChipPill(
                      label: slot.statusLabel,
                      backgroundColor: tone.background,
                      foregroundColor: tone.foreground,
                      borderColor: tone.border,
                      icon: Icons.local_shipping_outlined,
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Demand hint ${slot.demandHint} order${slot.demandHint == 1 ? '' : 's'}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: _inkSoft,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                _formatNumber(slot.plannedUnits),
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: _ink,
                ),
              ),
              Text(
                'planned units',
                style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: _inkSoft,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ExceptionsSummaryCard extends StatelessWidget {
  const _ExceptionsSummaryCard({required this.snapshot});

  final _ProductionSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final hasShortages = snapshot.shortageUnits > 0;

    return _PremiumCard(
      backgroundColor: hasShortages
          ? const Color(0xFFFFF7F4)
          : const Color(0xFFF6FBF7),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 38,
                width: 38,
                decoration: BoxDecoration(
                  color: (hasShortages ? _alert : _success).withValues(
                    alpha: 0.12,
                  ),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(
                  hasShortages
                      ? Icons.report_problem_outlined
                      : Icons.verified_outlined,
                  color: hasShortages ? _alert : _success,
                  size: 20,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      hasShortages
                          ? 'Active exceptions'
                          : 'No active exceptions',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: _ink,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      hasShortages
                          ? 'The batch has shortage lines that need floor attention.'
                          : 'The batch sheet is clean, with no shortages flagged right now.',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: _inkSoft,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _MetricTile(
                  label: 'Short lines',
                  value: snapshot.shortLineCount.toString(),
                  accentColor: hasShortages
                      ? const Color(0xFFF3B2A4)
                      : const Color(0xFFBFDCC8),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _MetricTile(
                  label: 'Short units',
                  value: _formatNumber(snapshot.shortageUnits),
                  accentColor: hasShortages
                      ? const Color(0xFFF3B2A4)
                      : const Color(0xFFBFDCC8),
                ),
              ),
            ],
          ),
          if (hasShortages) ...[
            const SizedBox(height: 12),
            ...snapshot.lines
                .where((line) => line.shortQuantity > 0)
                .map(
                  (line) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: _ExceptionRow(
                      title: line.productName,
                      detail:
                          '${line.shortQuantity} short in ${line.slotLabel}',
                    ),
                  ),
                ),
          ],
        ],
      ),
    );
  }
}

class _ReturnsCard extends StatelessWidget {
  const _ReturnsCard({required this.snapshot});

  final _ProductionSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final message = snapshot.shortageUnits > 0
        ? 'Hold rework and returns together so fulfillment can clear the batch in one pass.'
        : 'Returns are quiet right now. If delivery sends anything back, stage it beside the batch hold area.';

    return _PremiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Returns and rework',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w900,
              color: _ink,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            message,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: _inkSoft, height: 1.45),
          ),
          const SizedBox(height: 12),
          _MetricTile(
            label: 'Return watch',
            value: snapshot.shortageUnits > 0 ? 'On' : 'Quiet',
            accentColor: snapshot.shortageUnits > 0
                ? const Color(0xFFF3B2A4)
                : const Color(0xFFBFDCC8),
          ),
        ],
      ),
    );
  }
}

class _FulfillmentGateCard extends StatelessWidget {
  const _FulfillmentGateCard({required this.snapshot});

  final _ProductionSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final title = switch (snapshot.batch.status) {
      'draft' => 'Hold release until the batch is locked.',
      'locked' => 'Batch locked. Ready to start the floor run.',
      'in_progress' => 'Batch in progress. Keep fulfillment on hold.',
      'completed' => 'Batch complete. Release to fulfillment.',
      _ => 'Batch status is not recognized.',
    };

    final tone = switch (snapshot.batch.status) {
      'completed' => _SuccessTone.good,
      'in_progress' => _SuccessTone.warn,
      'locked' => _SuccessTone.info,
      _ => _SuccessTone.warn,
    };

    return _PremiumCard(
      backgroundColor: tone.background,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 38,
                width: 38,
                decoration: BoxDecoration(
                  color: tone.iconBackground,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(tone.icon, color: tone.foreground, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Fulfillment gate',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: _ink,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      title,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: _inkSoft,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _ChipPill(
            label: _prettyBatchStatus(snapshot.batch.status),
            backgroundColor: tone.iconBackground,
            foregroundColor: tone.foreground,
            borderColor: tone.iconBackground,
            icon: Icons.verified_outlined,
          ),
        ],
      ),
    );
  }
}

class _PremiumCard extends StatelessWidget {
  const _PremiumCard({
    required this.child,
    this.backgroundColor = _creamSurface,
  });

  final Widget child;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: const Color(0x1B17120E)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x12000000),
            blurRadius: 20,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );
  }
}

class SectionHeading extends StatelessWidget {
  const SectionHeading({super.key, required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w900,
            color: _ink,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: _inkSoft, height: 1.45),
        ),
      ],
    );
  }
}

class _ChipPill extends StatelessWidget {
  const _ChipPill({
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
    this.borderColor,
    this.icon,
  });

  final String label;
  final Color backgroundColor;
  final Color foregroundColor;
  final Color? borderColor;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final content = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 14, color: foregroundColor),
          const SizedBox(width: 6),
        ],
        Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
            color: foregroundColor,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.08,
          ),
        ),
      ],
    );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: borderColor ?? backgroundColor),
      ),
      child: content,
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({
    required this.label,
    required this.value,
    required this.accentColor,
    this.dark = false,
  });

  final String label;
  final String value;
  final Color accentColor;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    final labelColor = dark ? Colors.white.withValues(alpha: 0.72) : _inkSoft;
    final valueColor = dark ? Colors.white : _ink;
    final backgroundColor = dark
        ? Colors.white.withValues(alpha: 0.08)
        : Colors.white;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: accentColor.withValues(alpha: dark ? 0.28 : 0.45),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 4,
            width: 38,
            decoration: BoxDecoration(
              color: accentColor,
              borderRadius: BorderRadius.circular(999),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            label.toUpperCase(),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: labelColor,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.18,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: valueColor,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _NoteBlock extends StatelessWidget {
  const _NoteBlock({
    required this.title,
    required this.body,
    required this.icon,
    this.compact = false,
  });

  final String title;
  final String body;
  final IconData icon;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: compact ? 30 : 38,
          width: compact ? 30 : 38,
          decoration: BoxDecoration(
            color: _gold.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: _gold, size: compact ? 16 : 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: _ink,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                body,
                style: Theme.of(
                  context,
                ).textTheme.bodyMedium?.copyWith(color: _inkSoft, height: 1.45),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            fontWeight: FontWeight.w900,
            color: _ink,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          body,
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: _inkSoft, height: 1.45),
        ),
      ],
    );
  }
}

class _ChecklistItem {
  const _ChecklistItem({
    required this.label,
    required this.detail,
    required this.done,
  });

  final String label;
  final String detail;
  final bool done;
}

class _ChecklistRow extends StatelessWidget {
  const _ChecklistRow({required this.item});

  final _ChecklistItem item;

  @override
  Widget build(BuildContext context) {
    final tone = item.done ? _success : _gold;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: tone.withValues(alpha: 0.24)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 28,
            width: 28,
            decoration: BoxDecoration(
              color: tone.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              item.done ? Icons.check_rounded : Icons.radio_button_unchecked,
              color: tone,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.label,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: _ink,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  item.detail,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: _inkSoft,
                    fontWeight: FontWeight.w600,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ExceptionRow extends StatelessWidget {
  const _ExceptionRow({required this.title, required this.detail});

  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFF0B3A4)),
      ),
      child: Row(
        children: [
          Container(
            height: 26,
            width: 26,
            decoration: BoxDecoration(
              color: const Color(0xFFF9E1DB),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(
              Icons.report_problem_outlined,
              size: 16,
              color: _alert,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: _ink,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  detail,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: _inkSoft,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedbackBanner extends StatelessWidget {
  const _FeedbackBanner({required this.text, required this.tone});

  final String text;
  final _BannerTone tone;

  @override
  Widget build(BuildContext context) {
    final colors = switch (tone) {
      _BannerTone.bad => (
        const Color(0xFFFFEFEA),
        _alert,
        const Color(0xFFF7C0B4),
        Icons.error_outline,
      ),
      _BannerTone.good => (
        const Color(0xFFEAF7F0),
        _success,
        const Color(0xFFBFE0CF),
        Icons.check_circle_outline,
      ),
    };

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.$1,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.$3),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 32,
            width: 32,
            decoration: BoxDecoration(
              color: colors.$3.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(colors.$4, color: colors.$2, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: colors.$2,
                height: 1.4,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

enum _BannerTone { good, bad }

class _LoadingScreen extends StatelessWidget {
  const _LoadingScreen({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [AedenPalette.espresso, AedenPalette.chestnut, AedenPalette.cream],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            stops: [0.0, 0.4, 1.0],
          ),
        ),
        child: Center(
          child: Container(
            padding: const EdgeInsets.all(24),
            margin: const EdgeInsets.all(24),
            constraints: const BoxConstraints(maxWidth: 420),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x30000000),
                  blurRadius: 30,
                  offset: Offset(0, 16),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _ChipPill(
                  label: 'Aeden Bakes production',
                  backgroundColor: Colors.white.withValues(alpha: 0.08),
                  foregroundColor: Colors.white,
                  borderColor: Colors.white.withValues(alpha: 0.12),
                  icon: Icons.kitchen_outlined,
                ),
                const SizedBox(height: 20),
                Text(
                  message,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Pulling the live batch sheet, catalog, and order demand from the floor API.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.white.withValues(alpha: 0.72),
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 18),
                const LinearProgressIndicator(
                  minHeight: 8,
                  backgroundColor: Color(0x26FFFFFF),
                  valueColor: AlwaysStoppedAnimation<Color>(_gold),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({
    required this.message,
    required this.details,
    this.onRetry,
  });

  final String message;
  final String details;
  final Future<void> Function()? onRetry;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [AedenPalette.espresso, AedenPalette.cream],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  color: _creamSurface,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: const Color(0x1B17120E)),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x22000000),
                      blurRadius: 24,
                      offset: Offset(0, 14),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _ChipPill(
                      label: 'Production offline',
                      backgroundColor: const Color(0xFFFFEFEA),
                      foregroundColor: _alert,
                      borderColor: const Color(0xFFF1C0B4),
                      icon: Icons.cloud_off_outlined,
                    ),
                    const SizedBox(height: 18),
                    Text(
                      message,
                      style: Theme.of(context).textTheme.headlineSmall
                          ?.copyWith(
                            fontWeight: FontWeight.w900,
                            color: _ink,
                            letterSpacing: -0.4,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      details,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: _inkSoft,
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 18),
                    if (onRetry != null)
                      FilledButton.icon(
                        onPressed: () {
                          onRetry!();
                        },
                        icon: const Icon(Icons.refresh_rounded, size: 18),
                        label: const Text('Retry'),
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

Color _batchStatusColor(String status) {
  switch (status) {
    case 'draft':
      return _gold;
    case 'locked':
      return _blue;
    case 'in_progress':
      return _success;
    case 'completed':
      return const Color(0xFF3D7A59);
    default:
      return _inkSoft;
  }
}

String _prettyBatchStatus(String status) {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'locked':
      return 'Locked';
    case 'in_progress':
      return 'In progress';
    case 'completed':
      return 'Completed';
    default:
      return status.replaceAll('_', ' ');
  }
}

int _batchStageIndex(String status) {
  switch (status) {
    case 'draft':
      return 0;
    case 'locked':
      return 1;
    case 'in_progress':
      return 2;
    case 'completed':
      return 3;
    default:
      return 0;
  }
}

String _prettySlotLabel(String slotId) {
  final cleaned = slotId.replaceAll('_', ' ').trim();
  if (cleaned.isEmpty) {
    return 'Unknown slot';
  }
  return cleaned
      .split(' ')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1))
      .join(' ');
}

String _formatNumber(int value) {
  final negative = value < 0;
  final digits = value.abs().toString();
  final buffer = StringBuffer();

  for (var index = 0; index < digits.length; index++) {
    final remaining = digits.length - index;
    buffer.write(digits[index]);
    if (remaining > 1 && remaining % 3 == 1) {
      buffer.write(',');
    }
  }

  final formatted = buffer.toString();
  return negative ? '-$formatted' : formatted;
}

Color _tabIconColor(String batchStatus, String tabLabel) {
  if (tabLabel == 'Today') {
    return _batchStageIndex(batchStatus) >= 0 ? _gold : _inkSoft;
  }
  if (tabLabel == 'Stations') {
    return _blue;
  }
  if (tabLabel == 'Packing') {
    return _gold;
  }
  return _alert;
}

_Tone _lineTone(_ProductionLine line) {
  if (line.shortQuantity > 0) {
    return const _Tone(
      background: Color(0xFFF9DED8),
      foreground: _alert,
      border: Color(0xFFF0B2A1),
    );
  }

  if (line.productCategory.toLowerCase() == 'laminated') {
    return const _Tone(
      background: Color(0xFFF6E7D8),
      foreground: _blue,
      border: Color(0xFFBFD1E3),
    );
  }

  return const _Tone(
    background: Color(0xFFF2E4C9),
    foreground: _gold,
    border: Color(0xFFE2C68C),
  );
}

_Tone _stationTone(_StationSummary station) {
  if (station.shortageUnits > 0) {
    return const _Tone(
      background: Color(0xFFF9DED8),
      foreground: _alert,
      border: Color(0xFFF0B2A1),
    );
  }

  if (station.name == 'Lamination') {
    return const _Tone(
      background: Color(0xFFF6E7D8),
      foreground: _blue,
      border: Color(0xFFBFD1E3),
    );
  }

  return const _Tone(
    background: Color(0xFFF2E4C9),
    foreground: _gold,
    border: Color(0xFFE2C68C),
  );
}

_Tone _slotTone(_SlotSummary slot) {
  if (slot.shortageUnits > 0) {
    return const _Tone(
      background: Color(0xFFF9DED8),
      foreground: _alert,
      border: Color(0xFFF0B2A1),
    );
  }

  return const _Tone(
    background: Color(0xFFF6E7D8),
    foreground: _blue,
    border: Color(0xFFBFD1E3),
  );
}

class _Tone {
  const _Tone({
    required this.background,
    required this.foreground,
    required this.border,
  });

  final Color background;
  final Color foreground;
  final Color border;
}

class _SuccessTone {
  const _SuccessTone._({
    required this.background,
    required this.foreground,
    required this.border,
    required this.iconBackground,
    required this.icon,
  });

  final Color background;
  final Color foreground;
  final Color border;
  final Color iconBackground;
  final IconData icon;

  static const good = _SuccessTone._(
    background: Color(0xFFF3FAF5),
    foreground: _success,
    border: Color(0xFFBEE1CC),
    iconBackground: Color(0xFFDDEFE5),
    icon: Icons.verified_outlined,
  );

  static const warn = _SuccessTone._(
    background: Color(0xFFFFF8EE),
    foreground: _gold,
    border: Color(0xFFF0D8A7),
    iconBackground: Color(0xFFF7E7BF),
    icon: Icons.timelapse_outlined,
  );

  static const info = _SuccessTone._(
    background: Color(0xFFEFF5FB),
    foreground: _blue,
    border: Color(0xFFF0D8A7),
    iconBackground: Color(0xFFF7E7BF),
    icon: Icons.lock_outline,
  );
}

