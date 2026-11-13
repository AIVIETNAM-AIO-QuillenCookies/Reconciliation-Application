section Section1;

shared q_WEB_Raw = let
    Source = Csv.Document(File.Contents("D:\edaAIVietNam\Module 1\Project\Data\WEB_Orders_Export.csv"),[Delimiter=",", Columns=10, Encoding=65001, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type with Locale" = Table.TransformColumnTypes(#"Promoted Headers", {{"order_date", type date}, {"delivery_date", type date}, {"return_date", type date}}, "en-US")
in
    #"Changed Type with Locale";