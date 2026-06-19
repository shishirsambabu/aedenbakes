import 'package:flutter_test/flutter_test.dart';

import 'package:customer_app/main.dart';

void main() {
  testWidgets('shows the Aeden Bakes splash screen', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const AedenBakesCustomerApp());

    expect(find.text('Aeden Bakes'), findsOneWidget);
    expect(find.text('Get started'), findsOneWidget);
  });
}
