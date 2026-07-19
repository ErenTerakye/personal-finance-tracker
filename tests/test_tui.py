import asyncio

from textual.widgets import DataTable, Input, TabbedContent

from finance_tracker.services import AccountService, TransactionService
from finance_tracker.tui.app import FinanceTrackerTui
from finance_tracker.tui.views import AccountsView, TransactionsView


def test_tui_mounts_at_baseline_size_and_supports_keyboard_navigation(tmp_path):
    async def scenario() -> None:
        app = FinanceTrackerTui(db_path=tmp_path / "tui.sqlite3")
        async with app.run_test(size=(80, 24)) as pilot:
            await pilot.pause()
            assert app.has_class("narrow")
            assert app.query_one(TabbedContent).active == "overview-tab"

            await pilot.press("2")
            await pilot.pause()
            assert app.query_one(TabbedContent).active == "transactions-tab"

            await pilot.press("slash")
            assert app.focused is app.query_one("#transaction-search", Input)

            app.screen.set_focus(None)
            await pilot.press("3")
            await pilot.pause()
            assert app.query_one(TabbedContent).active == "budgets-tab"

    asyncio.run(scenario())


def test_tui_transaction_form_writes_and_refreshes_the_selected_ledger(tmp_path):
    async def scenario() -> None:
        db_path = tmp_path / "tui.sqlite3"
        app = FinanceTrackerTui(db_path=db_path)
        async with app.run_test(size=(120, 40)) as pilot:
            app.action_workspace("transactions-tab")
            view = app.query_one(TransactionsView)
            view._add(
                {
                    "type": "expense",
                    "amount": "42.50",
                    "category": "Food",
                    "description": "Terminal lunch",
                    "date": "2026-07-19",
                }
            )
            await pilot.pause()

            transactions = TransactionService(db_path).list_transactions()
            assert len(transactions) == 1
            assert transactions[0].description == "Terminal lunch"
            assert app.query_one(TransactionsView).query_one(DataTable).row_count == 1

    asyncio.run(scenario())


def test_tui_account_check_in_is_atomic_and_refreshes_net_worth(tmp_path):
    async def scenario() -> None:
        db_path = tmp_path / "tui.sqlite3"
        service = AccountService(db_path)
        first = service.create_account("Cash", "asset", "100", "2026-07-01")
        second = service.create_account("Card", "liability", "20", "2026-07-01")
        assert first.id is not None and second.id is not None
        app = FinanceTrackerTui(db_path=db_path)
        async with app.run_test(size=(120, 40)) as pilot:
            await pilot.press("4")
            await pilot.pause()
            view = app.query_one(AccountsView)
            view._check_in(
                {
                    "date": "2026-07-19",
                    "balances": f"{first.id}=150, {second.id}=25",
                }
            )
            await pilot.pause()
            resolved = service.list_accounts("2026-07-19")
            assert [str(item.balance) for item in resolved] == ["150.00", "25.00"]
            assert "125.00" in str(app.query_one("#net-worth-line").render())

    asyncio.run(scenario())
